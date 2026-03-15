import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { smsLogs, transactions } from "../../db/schema";
import { maskPhoneForLog } from "../../lib/log-redaction";
import { redactTokensInText } from "../../lib/token-redaction";
import { formatTokenSms, sendSms } from "../../services/sms.service";
import { syncTextSmsDeliveryStatus } from "../../services/textsms-dlr.service";
import { createQueue, QUEUE_NAMES } from "../connection";
import { isDlrSyncJob, isNotificationJob, isResendJob } from "../sms-guards";
import type {
  SmsDlrSyncJob,
  SmsJob,
  SmsNotificationJob,
  SmsResendJob,
} from "../types";

const smsDlrSyncQueue = createQueue(QUEUE_NAMES.SMS_DELIVERY);
const TEXTSMS_DLR_SYNC_DELAYS_MS = [60_000, 300_000, 900_000] as const;

/**
 * Parse cost string from provider (e.g., "KES 0.8000" -> "0.8000")
 */
function parseCost(cost: string | undefined): string | null {
  if (!cost) {
    return null;
  }
  // Remove currency code and spaces, e.g., "KES 0.8000" -> "0.8000"
  const numericPart = cost.replace(/[A-Za-z\s]/g, "");
  return numericPart || null;
}

/**
 * SMS Delivery Processor
 *
 * This job:
 * 1. Formats the token message
 * 2. Sends via Hostpinnacle
 * 3. Logs the delivery status
 */
export async function processSmsDelivery(
  job: Job<SmsJob>,
): Promise<{ messageId: string }> {
  if (isDlrSyncJob(job.data)) {
    return processDlrSync(job.data);
  }

  if (isResendJob(job.data)) {
    return processResendSms(job.data);
  }

  if (isNotificationJob(job.data)) {
    return processNotificationSms(job.data);
  }

  const { transactionId, phoneNumber, meterNumber, token, units } = job.data;
  const transaction = await db.query.transactions.findFirst({
    where: eq(transactions.id, transactionId),
    columns: {
      amountPaid: true,
      netAmount: true,
      commissionAmount: true,
      createdAt: true,
      completedAt: true,
    },
  });

  if (!transaction) {
    throw new Error(`Transaction ${transactionId} not found for SMS delivery`);
  }

  const message = formatTokenSms({
    meterNumber,
    token,
    transactionDate: transaction.completedAt ?? transaction.createdAt,
    units,
    amountPaid: transaction.amountPaid,
    tokenAmount: transaction.netAmount,
    otherCharges: transaction.commissionAmount,
  });

  console.log(`[SMS] Sending to ${maskPhoneForLog(phoneNumber)}`);

  // Create SMS log entry
  const [smsLog] = await db
    .insert(smsLogs)
    .values({
      transactionId,
      phoneNumber,
      messageBody: redactTokensInText(message),
      provider: "hostpinnacle",
      status: "queued",
    })
    .returning();

  // Send SMS
  const result = await sendSms(phoneNumber, message);

  // Update SMS log with result
  await db
    .update(smsLogs)
    .set({
      status: result.success ? "sent" : "failed",
      provider: resolveSmsProvider(result.provider),
      providerMessageId: result.messageId ?? null,
      cost: parseCost(result.cost),
      updatedAt: new Date(),
    })
    .where(eq(smsLogs.id, smsLog.id));

  if (!result.success) {
    throw new Error(`SMS delivery failed: ${result.error}`);
  }

  await queueTextSmsDlrSyncIfNeeded(smsLog.id, result);

  console.log(
    `[SMS] Delivered to ${maskPhoneForLog(phoneNumber)}, messageId: ${getRequiredMessageId(result.messageId, "delivery")}`,
  );

  return { messageId: getRequiredMessageId(result.messageId, "delivery") };
}

async function processResendSms(
  data: SmsResendJob,
): Promise<{ messageId: string }> {
  const { smsLogId, phoneNumber, messageBody } = data;

  console.log(`[SMS] Resending to ${maskPhoneForLog(phoneNumber)}`);

  await db
    .update(smsLogs)
    .set({ status: "queued", updatedAt: new Date() })
    .where(eq(smsLogs.id, smsLogId));

  const result = await sendSms(phoneNumber, messageBody);

  await db
    .update(smsLogs)
    .set({
      status: result.success ? "sent" : "failed",
      provider: resolveSmsProvider(result.provider),
      providerMessageId: result.messageId ?? null,
      cost: parseCost(result.cost),
      updatedAt: new Date(),
    })
    .where(eq(smsLogs.id, smsLogId));

  if (!result.success) {
    throw new Error(`SMS resend failed: ${result.error}`);
  }

  await queueTextSmsDlrSyncIfNeeded(smsLogId, result);

  console.log(
    `[SMS] Resent to ${maskPhoneForLog(phoneNumber)}, messageId: ${getRequiredMessageId(result.messageId, "resend")}`,
  );

  return { messageId: getRequiredMessageId(result.messageId, "resend") };
}

async function processNotificationSms(
  data: SmsNotificationJob,
): Promise<{ messageId: string }> {
  const phoneNumber = data.phoneNumber;
  const messageBody = data.messageBody;

  let smsLogId = data.smsLogId;
  if (smsLogId) {
    await db
      .update(smsLogs)
      .set({ status: "queued", updatedAt: new Date() })
      .where(eq(smsLogs.id, smsLogId));
  } else {
    const [smsLog] = await db
      .insert(smsLogs)
      .values({
        transactionId: data.transactionId ?? null,
        phoneNumber,
        messageBody: redactTokensInText(messageBody),
        provider: "hostpinnacle",
        status: "queued",
      })
      .returning({ id: smsLogs.id });

    smsLogId = smsLog.id;
  }

  const result = await sendSms(phoneNumber, messageBody);

  await db
    .update(smsLogs)
    .set({
      status: result.success ? "sent" : "failed",
      provider: resolveSmsProvider(result.provider),
      providerMessageId: result.messageId ?? null,
      cost: parseCost(result.cost),
      updatedAt: new Date(),
    })
    .where(eq(smsLogs.id, smsLogId));

  if (!result.success) {
    throw new Error(`SMS delivery failed: ${result.error}`);
  }

  await queueTextSmsDlrSyncIfNeeded(smsLogId, result);

  return { messageId: getRequiredMessageId(result.messageId, "notification") };
}

async function queueTextSmsDlrSyncIfNeeded(
  smsLogId: string,
  result: Awaited<ReturnType<typeof sendSms>>,
) {
  if (!result.success || result.provider !== "textsms" || !result.messageId) {
    return;
  }

  await scheduleTextSmsDlrSync({
    attempt: 1,
    kind: "dlr_sync",
    provider: "textsms",
    smsLogId,
  });
}

async function processDlrSync(
  data: SmsDlrSyncJob,
): Promise<{ messageId: string }> {
  const result = await syncTextSmsDeliveryStatus(data.smsLogId);
  if (!result.synced && data.attempt < TEXTSMS_DLR_SYNC_DELAYS_MS.length) {
    await scheduleTextSmsDlrSync({
      ...data,
      attempt: data.attempt + 1,
    });
  }

  return { messageId: `dlr-sync-${data.smsLogId}` };
}

async function scheduleTextSmsDlrSync(data: SmsDlrSyncJob) {
  const delay = TEXTSMS_DLR_SYNC_DELAYS_MS[data.attempt - 1] ?? 900_000;
  await smsDlrSyncQueue.add("sms-dlr-sync", data, {
    attempts: 1,
    delay,
    jobId: `sms-dlr-sync-${data.smsLogId}-${data.attempt}`,
  });
}

function resolveSmsProvider(provider: Awaited<ReturnType<typeof sendSms>>["provider"]) {
  return provider ?? "hostpinnacle";
}

function getRequiredMessageId(
  messageId: string | undefined,
  context: "delivery" | "notification" | "resend",
) {
  if (!messageId) {
    throw new Error(`SMS ${context} succeeded without a provider message id`);
  }

  return messageId;
}
