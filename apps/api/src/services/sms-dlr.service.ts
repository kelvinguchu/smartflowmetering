import { and, desc, eq } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { env } from "../config";
import { db } from "../db";
import { smsLogs } from "../db/schema";
import { normalizeKenyanPhoneNumber } from "../lib/staff-contact";

interface HostpinnacleDlrInput {
  deliveredTime?: string;
  errorCode?: string;
  messageId?: string;
  mobileNumber?: string;
  rawStatus?: string;
  receivedTime?: string;
  transactionId?: string;
}

export async function processHostpinnacleDlr(
  input: HostpinnacleDlrInput,
): Promise<{ matched: boolean; smsLogId: string | null; status: SmsLogStatus | null }> {
  const match = await findSmsLogForDlr(input);
  if (!match) {
    return { matched: false, smsLogId: null, status: null };
  }

  const resolvedStatus = mapDlrStatus(input.rawStatus, input.errorCode, input.deliveredTime);
  const providerReceivedAt = parseWebhookTimestamp(input.receivedTime);
  const providerDeliveredAt = parseWebhookTimestamp(input.deliveredTime);

  await db
    .update(smsLogs)
    .set({
      providerDeliveredAt,
      providerErrorCode: normalizeText(input.errorCode),
      providerMessageId: normalizeText(input.messageId) ?? match.providerMessageId,
      providerReceivedAt,
      providerStatus: normalizeText(input.rawStatus),
      status: resolvedStatus,
      updatedAt: new Date(),
    })
    .where(eq(smsLogs.id, match.id));

  return {
    matched: true,
    smsLogId: match.id,
    status: resolvedStatus,
  };
}

export function hasValidHostpinnacleWebhookToken(headerValue: string | null): boolean {
  if (!env.HOSTPINNACLE_DLR_WEBHOOK_TOKEN) {
    return env.NODE_ENV !== "production";
  }

  if (!headerValue) {
    return false;
  }

  const provided = Buffer.from(headerValue);
  const expected = Buffer.from(env.HOSTPINNACLE_DLR_WEBHOOK_TOKEN);
  if (provided.byteLength !== expected.byteLength) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}

async function findSmsLogForDlr(input: HostpinnacleDlrInput) {
  const messageId = normalizeText(input.messageId);
  if (messageId) {
    const byMessageId = await db.query.smsLogs.findFirst({
      where: eq(smsLogs.providerMessageId, messageId),
      columns: {
        id: true,
        phoneNumber: true,
        providerMessageId: true,
      },
    });
    if (byMessageId) {
      return byMessageId;
    }
  }

  const phoneNumber = normalizeWebhookPhoneNumber(input.mobileNumber);
  if (!phoneNumber) {
    return null;
  }

  const fallback = await db.query.smsLogs.findFirst({
    where: and(eq(smsLogs.phoneNumber, phoneNumber), eq(smsLogs.provider, "hostpinnacle")),
    orderBy: [desc(smsLogs.createdAt)],
    columns: {
      id: true,
      phoneNumber: true,
      providerMessageId: true,
    },
  });

  return fallback ?? null;
}

function normalizeWebhookPhoneNumber(phoneNumber: string | undefined): string | null {
  const value = normalizeText(phoneNumber);
  if (!value) {
    return null;
  }

  try {
    return normalizeKenyanPhoneNumber(value);
  } catch {
    return value;
  }
}

function normalizeText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ?? null;
}

function parseWebhookTimestamp(value: string | undefined): Date | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const epochMs = Number(normalized);
  if (Number.isFinite(epochMs) && normalized.length >= 10) {
    const date = new Date(normalized.length === 10 ? epochMs * 1000 : epochMs);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapDlrStatus(
  rawStatus: string | undefined,
  errorCode: string | undefined,
  deliveredTime: string | undefined,
): SmsLogStatus {
  const normalizedStatus = normalizeText(rawStatus)?.toLowerCase() ?? "";
  const normalizedError = normalizeText(errorCode)?.toLowerCase() ?? "";

  if (deliveredTime) {
    return "delivered";
  }

  if (
    normalizedStatus.includes("deliver") ||
    normalizedStatus === "success" ||
    normalizedStatus === "ok"
  ) {
    return "delivered";
  }

  if (
    normalizedStatus.includes("fail") ||
    normalizedStatus.includes("reject") ||
    normalizedStatus.includes("undeliver") ||
    (normalizedError !== "" && normalizedError !== "0")
  ) {
    return "failed";
  }

  if (
    normalizedStatus.includes("queue") ||
    normalizedStatus.includes("accept") ||
    normalizedStatus.includes("submit") ||
    normalizedStatus.includes("sent") ||
    normalizedStatus.includes("receive")
  ) {
    return "sent";
  }

  return "sent";
}

type SmsLogStatus = "delivered" | "failed" | "sent";
