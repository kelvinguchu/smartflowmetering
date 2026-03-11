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
  const cleanedPhoneNumber = phoneNumber.replaceAll(/[^0-9+]/g, "");

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

function getResponseValue(
  response: Record<string, unknown>,
  keys: string[],
): string {
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

    const status = getResponseValue(body, [
      "status",
      "responseCode",
    ]).toLowerCase();
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
  message: string,
): Promise<SmsResult> {
  return sendViaHostpinnacle(phoneNumber, message);
}

interface TokenSmsInput {
  meterNumber: string;
  token: string;
  transactionDate: Date;
  units: string;
  amountPaid: string;
  tokenAmount: string;
  otherCharges: string;
}

function formatTokenGroups(token: string): string {
  const digitsOnly = token.replaceAll(/\D/g, "");
  const source = digitsOnly || token;
  const grouped = source.replaceAll(/(.{4})/g, "$1-");
  return grouped.endsWith("-") ? grouped.slice(0, -1) : grouped;
}

function formatSmsDateTime(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";

  return `${year}${month}${day} ${hour}:${minute}`;
}

function formatUnits(units: string): string {
  const parsedUnits = Number.parseFloat(units);
  if (!Number.isFinite(parsedUnits)) return units;
  return parsedUnits.toString();
}

function formatMoney(amount: string): string {
  const parsedAmount = Number.parseFloat(amount);
  if (!Number.isFinite(parsedAmount)) return amount;
  return parsedAmount.toFixed(2);
}

/**
 * Format token SMS message.
 */
export function formatTokenSms(input: TokenSmsInput): string {
  const formattedToken = formatTokenGroups(input.token);
  const formattedDate = formatSmsDateTime(
    input.transactionDate,
    env.ALERT_TIMEZONE,
  );

  return `Mtr:${input.meterNumber}
Token:${formattedToken}
Date:${formattedDate}
Units:${formatUnits(input.units)}
Amt:${formatMoney(input.amountPaid)}
TknAmt:${formatMoney(input.tokenAmount)}
OtherCharges:${formatMoney(input.otherCharges)}`;
}

export function formatOnboardingApprovedSms(input: {
  landlordName: string;
  motherMeterNumber: string;
  subMeterCount: number;
}): string {
  return `Smart Flow Metering: Hello ${input.landlordName}, your meter application has been approved.
Mother meter: ${input.motherMeterNumber}
Registered sub-meters: ${input.subMeterCount}
You can now start vending tokens.`;
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
