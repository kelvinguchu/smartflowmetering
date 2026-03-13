import type { Job } from "bullmq";
import { db } from "../../db";
import { smsLogs, transactions } from "../../db/schema";
import { eq } from "drizzle-orm";
import type { SmsJob, SmsNotificationJob, SmsResendJob } from "../types";
import { isResendJob, isNotificationJob } from "../sms-guards";
import { sendSms, formatTokenSms } from "../../services/sms.service";
import { redactTokensInText } from "../../lib/token-redaction";
import { maskPhoneForLog } from "../../lib/log-redaction";

/**
 * Parse cost string from provider (e.g., "KES 0.8000" -> "0.8000")
 */
function parseCost(cost: string | undefined): string | null {
  if (!cost) return null;
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
  if (isResendJob(job.data)) {
    return processResendSms(job.data);
  }

  if (isNotificationJob(job.data)) {
    return processNotificationSms(job.data);
  }

  const { transactionId, phoneNumber, meterNumber, token, units, amount } =
    job.data;
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
    amountPaid: transaction.amountPaid ?? amount,
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
      provider: result.provider ?? "hostpinnacle",
      providerMessageId: result.messageId ?? null,
      cost: parseCost(result.cost),
      updatedAt: new Date(),
    })
    .where(eq(smsLogs.id, smsLog.id));

  if (!result.success) {
    throw new Error(`SMS delivery failed: ${result.error}`);
  }

  console.log(
    `[SMS] Delivered to ${maskPhoneForLog(phoneNumber)}, messageId: ${result.messageId}`,
  );

  return { messageId: result.messageId! };
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
      provider: result.provider ?? "hostpinnacle",
      providerMessageId: result.messageId ?? null,
      cost: parseCost(result.cost),
      updatedAt: new Date(),
    })
    .where(eq(smsLogs.id, smsLogId));

  if (!result.success) {
    throw new Error(`SMS resend failed: ${result.error}`);
  }

  console.log(
    `[SMS] Resent to ${maskPhoneForLog(phoneNumber)}, messageId: ${result.messageId}`,
  );

  return { messageId: result.messageId! };
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
      provider: result.provider ?? "hostpinnacle",
      providerMessageId: result.messageId ?? null,
      cost: parseCost(result.cost),
      updatedAt: new Date(),
    })
    .where(eq(smsLogs.id, smsLogId));

  if (!result.success) {
    throw new Error(`SMS delivery failed: ${result.error}`);
  }

  return { messageId: result.messageId! };
}
