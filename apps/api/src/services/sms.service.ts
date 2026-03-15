import { env } from "../config";
import {
  formatAdminTokenSms as formatAdminTokenSmsRaw,
  formatTokenSms as formatTokenSmsRaw,
} from "../lib/sms-formatters";
import {
  sendViaHostpinnacle,
  sendViaTextSms,
} from "./sms-provider-transports";
import type { SmsResult } from "./sms.types";

export {
  formatOnboardingApprovedSms,
} from "../lib/sms-formatters";

/**
 * Send SMS with the configured provider.
 */
export async function sendSms(
  phoneNumber: string,
  message: string,
): Promise<SmsResult> {
  const hostpinnacleResult = await sendViaHostpinnacle(phoneNumber, message);
  if (hostpinnacleResult.success) {
    return hostpinnacleResult;
  }

  console.warn(
    `[SMS] Hostpinnacle failed, attempting TextSMS fallback: ${hostpinnacleResult.error ?? "Unknown error"}`,
  );

  const textSmsResult = await sendViaTextSms(phoneNumber, message);
  if (textSmsResult.success) {
    return textSmsResult;
  }

  return {
    success: false,
    error: `HostPinnacle failed: ${hostpinnacleResult.error ?? "Unknown error"}; TextSMS failed: ${textSmsResult.error ?? "Unknown error"}`,
    provider: "textsms",
  };
}

interface TokenSmsServiceInput {
  meterNumber: string;
  token: string;
  transactionDate: Date;
  units: string;
  amountPaid: string;
  tokenAmount: string;
  otherCharges: string;
}

/**
 * Format token SMS message using the configured alert timezone.
 */
export function formatTokenSms(input: TokenSmsServiceInput): string {
  return formatTokenSmsRaw({ ...input, timezone: env.ALERT_TIMEZONE });
}

export function formatAdminTokenSms(input: {
  meterNumber: string;
  token: string;
  tokenType: "clear_tamper" | "clear_credit" | "set_power_limit" | "key_change";
  power?: number;
  sgcId?: string;
}): string {
  return formatAdminTokenSmsRaw(input);
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
