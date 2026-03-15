import { env } from "../config";
import { fetchSensitiveWithTimeout } from "../lib/fetch-sensitive-with-timeout";
import {
  formatPhoneForSms,
  getResponseValue,
  SMS_REQUEST_TIMEOUT_MS,
} from "./sms-provider.utils";
import type { SmsJsonObject } from "./sms-provider.utils";
import type { SmsResult } from "./sms.types";

function getMissingHostpinnacleEnvVars(): string[] {
  const required: [string, string | undefined][] = [
    ["HOSTPINNACLE_API_URL", env.HOSTPINNACLE_API_URL],
    ["HOSTPINNACLE_USER_ID", env.HOSTPINNACLE_USER_ID],
    ["HOSTPINNACLE_PASSWORD", env.HOSTPINNACLE_PASSWORD],
    ["HOSTPINNACLE_API_KEY", env.HOSTPINNACLE_API_KEY],
    ["HOSTPINNACLE_SENDER_ID", env.HOSTPINNACLE_SENDER_ID],
  ];

  return required.filter(([, value]) => !value).map(([name]) => name);
}

function getMissingTextSmsEnvVars(): string[] {
  const required: [string, string | undefined][] = [
    ["TEXTSMS_API_URL", env.TEXTSMS_API_URL],
    ["TEXTSMS_PARTNER_ID", env.TEXTSMS_PARTNER_ID],
    ["TEXTSMS_API_KEY", env.TEXTSMS_API_KEY],
    ["TEXTSMS_SENDER_ID", env.TEXTSMS_SENDER_ID],
  ];

  return required.filter(([, value]) => !value).map(([name]) => name);
}

function parseJsonObject(rawBody: string): SmsJsonObject | null {
  try {
    return JSON.parse(rawBody) as SmsJsonObject;
  } catch {
    return null;
  }
}

export async function sendViaHostpinnacle(
  phoneNumber: string,
  message: string,
): Promise<SmsResult> {
  const missingEnv = getMissingHostpinnacleEnvVars();
  if (missingEnv.length > 0) {
    console.warn(`[SMS] Hostpinnacle not configured: ${missingEnv.join(", ")}`);
    return {
      success: false,
      error: `Missing SMS configuration: ${missingEnv.join(", ")}`,
      provider: "hostpinnacle",
    };
  }

  const payload = new URLSearchParams({
    userid: env.HOSTPINNACLE_USER_ID,
    password: env.HOSTPINNACLE_PASSWORD,
    senderid: env.HOSTPINNACLE_SENDER_ID,
    mobile: formatPhoneForSms(phoneNumber),
    msg: message,
    msgType: "text",
    duplicatecheck: "true",
    output: "json",
    sendMethod: "quick",
  });

  try {
    const response = await fetchSensitiveWithTimeout(env.HOSTPINNACLE_API_URL, {
      method: "POST",
      timeoutMs: SMS_REQUEST_TIMEOUT_MS,
      headers: {
        apikey: env.HOSTPINNACLE_API_KEY,
        "cache-control": "no-cache",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload,
    });

    const rawBody = await response.text();
    const body = parseJsonObject(rawBody) ?? {};
    const status = getResponseValue(body, ["status", "responseCode"]).toLowerCase();
    const messageId = getResponseValue(body, ["msgid", "messageId", "id"]);
    const errorMessage =
      getResponseValue(body, ["message", "error", "responseDescription"]) ||
      (rawBody.trim() ? rawBody : `HTTP ${response.status}`);
    const successStatus =
      status === "success" || status === "ok" || status === "queued";

    if ((response.ok && !status) || successStatus) {
      return {
        success: true,
        messageId: messageId || undefined,
        provider: "hostpinnacle",
      };
    }

    return {
      success: false,
      error: errorMessage,
      provider: "hostpinnacle",
    };
  } catch (error) {
    console.error("[SMS] HostPinnacle error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      provider: "hostpinnacle",
    };
  }
}

export async function sendViaTextSms(
  phoneNumber: string,
  message: string,
): Promise<SmsResult> {
  const missingEnv = getMissingTextSmsEnvVars();
  if (missingEnv.length > 0) {
    console.warn(`[SMS] TextSMS not configured: ${missingEnv.join(", ")}`);
    return {
      success: false,
      error: `Missing SMS configuration: ${missingEnv.join(", ")}`,
      provider: "textsms",
    };
  }

  const payload = JSON.stringify({
    apikey: env.TEXTSMS_API_KEY,
    message,
    mobile: formatPhoneForSms(phoneNumber),
    partnerID: env.TEXTSMS_PARTNER_ID,
    pass_type: env.TEXTSMS_PASS_TYPE,
    shortcode: env.TEXTSMS_SENDER_ID,
  });

  try {
    const response = await fetchSensitiveWithTimeout(env.TEXTSMS_API_URL, {
      method: "POST",
      timeoutMs: SMS_REQUEST_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
      },
      body: payload,
    });

    const rawBody = await response.text();
    const body = parseJsonObject(rawBody);
    const responses = Array.isArray(body?.responses) ? body.responses : [];
    const firstResponse =
      responses.length > 0 &&
      typeof responses[0] === "object" &&
      responses[0] !== null
        ? (responses[0] as SmsJsonObject)
        : null;
    const responseCode = firstResponse?.["respose-code"];
    const responseDescription = getResponseValue(firstResponse ?? {}, [
      "response-description",
    ]);
    const messageId = getResponseValue(firstResponse ?? {}, ["messageid"]);

    if (response.ok && responseCode === 200) {
      return {
        success: true,
        messageId: messageId || undefined,
        provider: "textsms",
      };
    }

    return {
      success: false,
      error:
        responseDescription ||
        (rawBody.trim() ? rawBody : `HTTP ${response.status}`),
      provider: "textsms",
    };
  } catch (error) {
    console.error("[SMS] TextSMS error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      provider: "textsms",
    };
  }
}
