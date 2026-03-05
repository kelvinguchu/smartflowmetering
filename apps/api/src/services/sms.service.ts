import { env } from "../config";

/**
 * SMS Service
 *
 * Handles SMS delivery through Hostpinnacle.
 */

export interface SmsResult {
  success: boolean;
  messageId?: string;
  cost?: string;
  error?: string;
  provider?: "hostpinnacle";
}

function formatPhoneForSms(phoneNumber: string): string {
  const cleanedPhoneNumber = phoneNumber.replace(/[^0-9+]/g, "");

  if (cleanedPhoneNumber.startsWith("+")) {
    return cleanedPhoneNumber.slice(1);
  }

  if (cleanedPhoneNumber.startsWith("0")) {
    return `254${cleanedPhoneNumber.slice(1)}`;
  }

  if (/^\d{9}$/.test(cleanedPhoneNumber)) {
    return `254${cleanedPhoneNumber}`;
  }

  return cleanedPhoneNumber;
}

function getMissingHostpinnacleEnvVars(): string[] {
  const required: Array<[string, string | undefined]> = [
    ["HOSTPINNACLE_API_URL", env.HOSTPINNACLE_API_URL],
    ["HOSTPINNACLE_USER_ID", env.HOSTPINNACLE_USER_ID],
    ["HOSTPINNACLE_PASSWORD", env.HOSTPINNACLE_PASSWORD],
    ["HOSTPINNACLE_API_KEY", env.HOSTPINNACLE_API_KEY],
    ["HOSTPINNACLE_SENDER_ID", env.HOSTPINNACLE_SENDER_ID],
  ];

  return required.filter(([, value]) => !value).map(([name]) => name);
}

function parseHostpinnacleResponse(rawBody: string): Record<string, unknown> {
  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getResponseValue(response: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = response[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "";
}

/**
 * Send SMS via Hostpinnacle.
 */
export async function sendViaHostpinnacle(
  phoneNumber: string,
  message: string
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

  const formattedPhone = formatPhoneForSms(phoneNumber);
  const payload = new URLSearchParams({
    userid: env.HOSTPINNACLE_USER_ID,
    password: env.HOSTPINNACLE_PASSWORD,
    senderid: env.HOSTPINNACLE_SENDER_ID,
    mobile: formattedPhone,
    msg: message,
    msgType: "text",
    duplicatecheck: "true",
    output: "json",
    sendMethod: "quick",
  });

  try {
    const response = await fetch(env.HOSTPINNACLE_API_URL, {
      method: "POST",
      headers: {
        apikey: env.HOSTPINNACLE_API_KEY,
        "cache-control": "no-cache",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload,
    });

    const rawBody = await response.text();
    const body = parseHostpinnacleResponse(rawBody);

    const status = getResponseValue(body, ["status", "responseCode"]).toLowerCase();
    const messageId = getResponseValue(body, ["msgid", "messageId", "id"]);
    const errorMessage =
      getResponseValue(body, ["message", "error", "responseDescription"]) ||
      (rawBody.trim() ? rawBody : `HTTP ${response.status}`);

    const successStatus = status === "success" || status === "ok" || status === "queued";
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
    console.error("[SMS] Hostpinnacle error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      provider: "hostpinnacle",
    };
  }
}

/**
 * Send SMS with the configured provider.
 */
export async function sendSms(
  phoneNumber: string,
  message: string
): Promise<SmsResult> {
  return sendViaHostpinnacle(phoneNumber, message);
}

/**
 * Format token SMS message.
 */
export function formatTokenSms(
  meterNumber: string,
  token: string,
  units: string,
  amount: string
): string {
  const formattedToken = token.replace(/(.{4})/g, "$1-").slice(0, -1);

  return `Smart Flow Metering: Token for meter ${meterNumber}
Amount: KES ${amount}
Units: ${units} kWh
Token: ${formattedToken}
Enter this token on your meter.`;
}

/**
 * Mock SMS for development/testing.
 */
export function mockSmsSuccess(): SmsResult {
  return {
    success: true,
    messageId: `mock-${Date.now()}`,
    cost: "0.00",
    provider: "hostpinnacle",
  };
}
