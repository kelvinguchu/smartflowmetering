import { env } from "../config";

/**
 * SMS Service
 *
 * Handles SMS delivery with:
 * - Sandbox/Live environment switching
 * - Africa's Talking (primary) + Hostpinnacle (fallback)
 * - Sender ID configuration
 */

// SMS result type
export interface SmsResult {
  success: boolean;
  messageId?: string;
  cost?: string;
  error?: string;
  provider?: "africastalking" | "hostpinnacle";
}

// Get the appropriate API key based on environment
function getAfricasTalkingApiKey(): string {
  if (env.AFRICASTALKING_ENVIRONMENT === "sandbox") {
    return env.AFRICASTALKING_SANDBOX_API_KEY || env.AFRICASTALKING_API_KEY;
  }
  return env.AFRICASTALKING_API_KEY;
}

// Get the appropriate API URL based on environment
function getAfricasTalkingApiUrl(): string {
  if (env.AFRICASTALKING_ENVIRONMENT === "sandbox") {
    return "https://api.sandbox.africastalking.com/version1/messaging";
  }
  return "https://api.africastalking.com/version1/messaging";
}

// Get the username (sandbox uses 'sandbox', live uses configured username)
function getAfricasTalkingUsername(): string {
  if (env.AFRICASTALKING_ENVIRONMENT === "sandbox") {
    return "sandbox";
  }
  return env.AFRICASTALKING_USERNAME;
}

/**
 * Send SMS via Africa's Talking
 */
export async function sendViaAfricasTalking(
  phoneNumber: string,
  message: string
): Promise<SmsResult> {
  const apiKey = getAfricasTalkingApiKey();
  const apiUrl = getAfricasTalkingApiUrl();
  const username = getAfricasTalkingUsername();

  if (!apiKey) {
    console.warn("[SMS] Africa's Talking not configured");
    return { success: false, error: "API key not configured" };
  }

  try {
    // Build request params
    const params = new URLSearchParams({
      username,
      to: phoneNumber,
      message,
    });

    // Add sender ID if configured and verified (live only)
    if (env.AFRICASTALKING_ENVIRONMENT === "live" && env.AFRICASTALKING_SENDER_ID) {
      params.append("from", env.AFRICASTALKING_SENDER_ID);
    }

    console.log(`[SMS] Sending via Africa's Talking (${env.AFRICASTALKING_ENVIRONMENT})`);
    console.log(`[SMS] URL: ${apiUrl}`);
    console.log(`[SMS] Username: ${username}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        apiKey,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[SMS] HTTP error: ${response.status}`, text);
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }

    const data = (await response.json()) as {
      SMSMessageData: {
        Message: string;
        Recipients: Array<{
          messageId: string;
          cost: string;
          status: string;
          statusCode: number;
          number: string;
        }>;
      };
    };

    console.log(`[SMS] Response:`, JSON.stringify(data, null, 2));

    const recipient = data.SMSMessageData.Recipients[0];

    if (!recipient) {
      return {
        success: false,
        error: data.SMSMessageData.Message || "No recipients in response",
        provider: "africastalking",
      };
    }

    // Check status code (101 = Sent, 100 = Processed)
    if (recipient.statusCode === 101 || recipient.statusCode === 100 || recipient.status === "Success") {
      return {
        success: true,
        messageId: recipient.messageId,
        cost: recipient.cost,
        provider: "africastalking",
      };
    }

    // Map error codes to messages
    const errorMessages: Record<number, string> = {
      401: "RiskHold",
      402: "InvalidSenderId",
      403: "InvalidPhoneNumber",
      404: "UnsupportedNumberType",
      405: "InsufficientBalance",
      406: "UserInBlacklist",
      407: "CouldNotRoute",
      409: "DoNotDisturbRejection",
      500: "InternalServerError",
      501: "GatewayError",
      502: "RejectedByGateway",
    };

    return {
      success: false,
      error: errorMessages[recipient.statusCode] || recipient.status || "Unknown error",
      provider: "africastalking",
    };
  } catch (error) {
    console.error("[SMS] Africa's Talking error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      provider: "africastalking",
    };
  }
}

/**
 * Send SMS via Hostpinnacle (fallback)
 */
export async function sendViaHostpinnacle(
  phoneNumber: string,
  message: string
): Promise<SmsResult> {
  if (!env.HOSTPINNACLE_API_KEY) {
    console.warn("[SMS] Hostpinnacle not configured");
    return { success: false, error: "API key not configured" };
  }

  try {
    console.log("[SMS] Sending via Hostpinnacle (fallback)");

    const response = await fetch(
      "https://smsportal.hostpinnacle.co.ke/SMSApi/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: env.HOSTPINNACLE_API_KEY,
          senderId: env.HOSTPINNACLE_SENDER_ID || "OHMKenya",
          phone: phoneNumber,
          message,
        }),
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
        provider: "hostpinnacle",
      };
    }

    const data = (await response.json()) as {
      messageId?: string;
      status?: string;
    };

    if (data.messageId) {
      return {
        success: true,
        messageId: data.messageId,
        provider: "hostpinnacle",
      };
    }

    return {
      success: false,
      error: data.status ?? "Unknown error",
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
 * Send SMS with automatic fallback
 *
 * Tries Africa's Talking first, falls back to Hostpinnacle if it fails
 */
export async function sendSms(
  phoneNumber: string,
  message: string
): Promise<SmsResult> {
  // Try primary provider
  let result = await sendViaAfricasTalking(phoneNumber, message);

  // Fallback to secondary if primary fails
  if (!result.success) {
    console.log("[SMS] Primary provider failed, trying fallback...");
    result = await sendViaHostpinnacle(phoneNumber, message);
  }

  return result;
}

/**
 * Format token SMS message
 */
export function formatTokenSms(
  meterNumber: string,
  token: string,
  units: string,
  amount: string
): string {
  // Format token with dashes: 1234-5678-9012-3456-7890
  const formattedToken = token.replace(/(.{4})/g, "$1-").slice(0, -1);

  return `OHMKenya: Token for meter ${meterNumber}
Amount: KES ${amount}
Units: ${units} kWh
Token: ${formattedToken}
Enter this token on your meter.`;
}

/**
 * Mock SMS for development/testing
 */
export function mockSmsSuccess(): SmsResult {
  return {
    success: true,
    messageId: `mock-${Date.now()}`,
    cost: "0.00",
    provider: "africastalking",
  };
}
