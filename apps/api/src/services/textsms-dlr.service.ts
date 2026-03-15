import { eq } from "drizzle-orm";
import { env } from "../config";
import { db } from "../db";
import { smsLogs } from "../db/schema";
import { fetchSensitiveWithTimeout } from "../lib/fetch-sensitive-with-timeout";
import {
  getResponseValue,
  SMS_REQUEST_TIMEOUT_MS,
} from "./sms-provider.utils";
import type { SmsJsonObject } from "./sms-provider.utils";

export type SmsLogStatus = "delivered" | "failed" | "sent";

interface TextSmsDlrPayload {
  deliveredTime: Date | null;
  errorCode: string | null;
  providerMessageId: string | null;
  providerStatus: string | null;
  status: SmsLogStatus | null;
}

export interface TextSmsDlrSyncResult {
  provider: "textsms";
  providerMessageId: string | null;
  smsLogId: string;
  status: SmsLogStatus | null;
  synced: boolean;
}

export async function syncTextSmsDeliveryStatus(
  smsLogId: string,
): Promise<TextSmsDlrSyncResult> {
  const smsLog = await db.query.smsLogs.findFirst({
    where: eq(smsLogs.id, smsLogId),
    columns: {
      id: true,
      provider: true,
      providerMessageId: true,
      status: true,
    },
  });

  if (!smsLog) {
    throw new Error("SMS log not found");
  }

  if (smsLog.provider !== "textsms") {
    throw new Error("Only TextSMS delivery sync is supported here");
  }

  if (!smsLog.providerMessageId) {
    return {
      provider: "textsms",
      providerMessageId: null,
      smsLogId,
      status: smsLog.status === "queued" ? "sent" : smsLog.status,
      synced: false,
    };
  }

  const payload = await fetchTextSmsDlr(smsLog.providerMessageId);
  if (payload.status === null && payload.providerStatus === null) {
    return {
      provider: "textsms",
      providerMessageId: smsLog.providerMessageId,
      smsLogId,
      status: smsLog.status === "queued" ? "sent" : smsLog.status,
      synced: false,
    };
  }

  await db
    .update(smsLogs)
    .set({
      providerDeliveredAt: payload.deliveredTime,
      providerErrorCode: payload.errorCode,
      providerMessageId: payload.providerMessageId ?? smsLog.providerMessageId,
      providerStatus: payload.providerStatus,
      status: payload.status ?? smsLog.status,
      updatedAt: new Date(),
    })
    .where(eq(smsLogs.id, smsLogId));

  return {
    provider: "textsms",
    providerMessageId: payload.providerMessageId ?? smsLog.providerMessageId,
    smsLogId,
    status: payload.status,
    synced: true,
  };
}

async function fetchTextSmsDlr(messageId: string): Promise<TextSmsDlrPayload> {
  if (!env.TEXTSMS_DLR_API_URL || !env.TEXTSMS_API_KEY || !env.TEXTSMS_PARTNER_ID) {
    throw new Error("TextSMS DLR configuration is incomplete");
  }

  const response = await fetchSensitiveWithTimeout(env.TEXTSMS_DLR_API_URL, {
    method: "POST",
    timeoutMs: SMS_REQUEST_TIMEOUT_MS,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apikey: env.TEXTSMS_API_KEY,
      messageID: messageId,
      partnerID: env.TEXTSMS_PARTNER_ID,
    }),
  });

  const rawBody = await response.text();
  const body = parseJsonObject(rawBody);
  const firstResponse = getFirstResponse(body);
  const source = firstResponse ?? body ?? {};
  const responseDescription = getResponseValue(source, [
    "response-description",
    "responseDescription",
    "message",
  ]);
  const responseCode = getResponseValue(source, [
    "respose-code",
    "response-code",
    "responseCode",
    "code",
  ]);

  if (!response.ok) {
    throw new Error(responseDescription || `HTTP ${response.status}`);
  }

  if (responseCode === "1008" || responseDescription.toLowerCase() === "no delivery report") {
    return {
      deliveredTime: null,
      errorCode: null,
      providerMessageId: messageId,
      providerStatus: null,
      status: null,
    };
  }

  const providerStatus =
    getResponseValue(source, [
      "status",
      "deliveryStatus",
      "delivery-status",
      "response-description",
    ]) || null;
  const errorCode =
    getResponseValue(source, ["errorCode", "error_code", "respose-code"]) || null;
  const deliveredTime = parseTimestamp(
    getResponseValue(source, ["deliveredTime", "delivered_time", "deliveryTime"]),
  );

  return {
    deliveredTime,
    errorCode,
    providerMessageId:
      getResponseValue(source, ["messageid", "messageID", "messageId"]) || messageId,
    providerStatus,
    status: mapTextSmsStatus(providerStatus, errorCode, deliveredTime),
  };
}

function getFirstResponse(body: SmsJsonObject | null): SmsJsonObject | null {
  const responses = body?.responses;
  if (!Array.isArray(responses) || responses.length === 0) {
    return null;
  }

  const first = responses[0];
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return null;
  }

  return first;
}

function parseJsonObject(rawBody: string): SmsJsonObject | null {
  try {
    return JSON.parse(rawBody) as SmsJsonObject;
  } catch {
    return null;
  }
}

function parseTimestamp(value: string): Date | null {
  if (!value) {
    return null;
  }

  const epochMs = Number(value);
  if (Number.isFinite(epochMs) && value.length >= 10) {
    const date = new Date(value.length === 10 ? epochMs * 1000 : epochMs);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapTextSmsStatus(
  providerStatus: string | null,
  errorCode: string | null,
  deliveredTime: Date | null,
): SmsLogStatus {
  const normalizedStatus = providerStatus?.trim().toLowerCase() ?? "";
  const normalizedError = errorCode?.trim().toLowerCase() ?? "";

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
    (normalizedError !== "" && normalizedError !== "0" && normalizedError !== "200")
  ) {
    return "failed";
  }

  return "sent";
}
