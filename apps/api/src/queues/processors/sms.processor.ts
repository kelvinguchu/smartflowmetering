import type { Job } from "bullmq";
import { db } from "../../db";
import { smsLogs } from "../../db/schema";
import { eq } from "drizzle-orm";
import type {
  SmsDeliveryJob,
  SmsJob,
  SmsNotificationJob,
  SmsResendJob,
} from "../types";
import {
  sendSms,
  formatTokenSms,
} from "../../services/sms.service";

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
  job: Job<SmsJob>
): Promise<{ messageId: string }> {
  if (isNotificationJob(job.data)) {
    return processNotificationSms(job.data);
  }

  const { transactionId, phoneNumber, meterNumber, token, units, amount } = job.data;
  const message = formatTokenSms(meterNumber, token, units, amount);

  console.log(
    `[SMS] Sending to ${phoneNumber}: ${message.substring(0, 50)}...`
  );

  // Create SMS log entry
  const [smsLog] = await db
    .insert(smsLogs)
    .values({
      transactionId,
      phoneNumber,
      messageBody: message,
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
    `[SMS] Delivered to ${phoneNumber}, messageId: ${result.messageId}`
  );

  return { messageId: result.messageId! };
}

/**
 * SMS Resend Processor
 * For manual resends triggered by admin
 */
export async function processSmsResend(
  job: Job<SmsResendJob>
): Promise<{ messageId: string }> {
  const { smsLogId, phoneNumber, messageBody } = job.data;

  console.log(`[SMS] Resending to ${phoneNumber}`);

  // Update existing log to show retry
  await db
    .update(smsLogs)
    .set({ status: "queued", updatedAt: new Date() })
    .where(eq(smsLogs.id, smsLogId));

  // Send SMS
  const result = await sendSms(phoneNumber, messageBody);

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
    .where(eq(smsLogs.id, smsLogId));

  if (!result.success) {
    throw new Error(`SMS resend failed: ${result.error}`);
  }

  console.log(`[SMS] Resent to ${phoneNumber}, messageId: ${result.messageId}`);

  return { messageId: result.messageId! };
}

async function processNotificationSms(
  data: SmsNotificationJob
): Promise<{ messageId: string }> {
  const phoneNumber = data.phoneNumber;
  const messageBody = data.messageBody;

  let smsLogId = data.smsLogId;
  if (!smsLogId) {
    const [smsLog] = await db
      .insert(smsLogs)
      .values({
        transactionId: data.transactionId ?? null,
        phoneNumber,
        messageBody,
        provider: "hostpinnacle",
        status: "queued",
      })
      .returning({ id: smsLogs.id });

    smsLogId = smsLog.id;
  } else {
    await db
      .update(smsLogs)
      .set({ status: "queued", updatedAt: new Date() })
      .where(eq(smsLogs.id, smsLogId));
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

function isNotificationJob(
  data: SmsJob
): data is SmsNotificationJob | SmsResendJob {
  return "messageBody" in data;
}
