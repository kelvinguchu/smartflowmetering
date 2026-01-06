import { env } from "../config";

/**
 * M-Pesa Daraja API Service
 *
 * Handles:
 * - OAuth token generation
 * - STK Push (Lipa Na M-Pesa Online)
 * - Transaction status queries
 */

// API URLs based on environment
const API_URLS = {
  sandbox: {
    oauth:
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    stkPush: "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    stkQuery: "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query",
  },
  production: {
    oauth:
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    stkPush: "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    stkQuery: "https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query",
  },
};

/**
 * Sandbox test credentials (official Safaricom test values)
 * These are publicly available and work for STK Push testing
 */
const SANDBOX_CREDENTIALS = {
  shortcode: "174379",
  passkey: "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
};

/**
 * Get the correct shortcode based on environment
 */
function getShortcode(): string {
  if (env.MPESA_ENVIRONMENT === "sandbox") {
    return SANDBOX_CREDENTIALS.shortcode;
  }
  return env.MPESA_SHORTCODE;
}

/**
 * Get the correct passkey based on environment
 */
function getPasskey(): string {
  if (env.MPESA_ENVIRONMENT === "sandbox") {
    return SANDBOX_CREDENTIALS.passkey;
  }
  return env.MPESA_PASSKEY;
}

// Cache for OAuth token
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get OAuth access token (cached)
 */
export async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(
    `${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const response = await fetch(API_URLS[env.MPESA_ENVIRONMENT].oauth, {
    method: "GET",
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`M-Pesa OAuth failed: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: string;
  };

  // Cache the token (expires_in is in seconds, subtract 60s for safety)
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (Number.parseInt(data.expires_in, 10) - 60) * 1000,
  };

  return cachedToken.token;
}

/**
 * Generate STK Push password
 * Password = Base64(Shortcode + Passkey + Timestamp)
 */
function generatePassword(timestamp: string): string {
  const shortcode = getShortcode();
  const passkey = getPasskey();
  const str = `${shortcode}${passkey}${timestamp}`;
  return Buffer.from(str).toString("base64");
}

/**
 * Generate timestamp in format YYYYMMDDHHmmss
 */
function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * STK Push Request Parameters
 */
export interface StkPushRequest {
  phoneNumber: string; // Format: 254XXXXXXXXX
  amount: number;
  accountReference: string; // Account reference (meter number)
  transactionDesc?: string;
  callbackUrl?: string; // Optional, uses env default if not provided
}

/**
 * STK Push Response
 */
export interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

/**
 * STK Push Result (normalized response for routes)
 */
export interface StkPushResult {
  success: boolean;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  customerMessage?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Initiate STK Push (Lipa Na M-Pesa Online)
 */
export async function initiateStkPush(
  request: StkPushRequest
): Promise<StkPushResult> {
  const accessToken = await getAccessToken();
  const timestamp = generateTimestamp();
  const password = generatePassword(timestamp);

  // Use callback URL from request or fall back to env
  const callbackUrl = request.callbackUrl || env.MPESA_CALLBACK_URL;
  const shortcode = getShortcode();

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: request.amount,
    PartyA: request.phoneNumber,
    PartyB: shortcode,
    PhoneNumber: request.phoneNumber,
    CallBackURL: `${callbackUrl}/stk-push/callback`,
    AccountReference: request.accountReference,
    TransactionDesc:
      request.transactionDesc ??
      `Token purchase for ${request.accountReference}`,
  };

  console.log(
    `[M-Pesa STK] Initiating push to ${request.phoneNumber} for ${request.amount} KES`
  );

  try {
    const response = await fetch(API_URLS[env.MPESA_ENVIRONMENT].stkPush, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as StkPushResponse & {
      errorCode?: string;
      errorMessage?: string;
    };

    if (!response.ok || data.errorCode) {
      console.error(`[M-Pesa STK] Error:`, data);
      return {
        success: false,
        error: data.errorMessage ?? data.ResponseDescription ?? "Unknown error",
        errorCode: data.errorCode,
      };
    }

    console.log(
      `[M-Pesa STK] Success: CheckoutRequestID=${data.CheckoutRequestID}`
    );

    return {
      success: true,
      checkoutRequestId: data.CheckoutRequestID,
      merchantRequestId: data.MerchantRequestID,
      customerMessage: data.CustomerMessage,
    };
  } catch (error) {
    console.error(`[M-Pesa STK] Exception:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * STK Push Callback Payload (from Safaricom)
 */
export interface StkPushCallback {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value?: string | number;
        }>;
      };
    };
  };
}

/**
 * Parse STK Push callback to extract transaction details
 */
export function parseStkCallback(callback: StkPushCallback): {
  success: boolean;
  checkoutRequestId: string;
  merchantRequestId: string;
  resultCode: number;
  resultDesc: string;
  mpesaReceiptNumber?: string;
  amount?: number;
  phoneNumber?: string;
  transactionDate?: string;
} {
  const { stkCallback } = callback.Body;

  const result = {
    success: stkCallback.ResultCode === 0,
    checkoutRequestId: stkCallback.CheckoutRequestID,
    merchantRequestId: stkCallback.MerchantRequestID,
    resultCode: stkCallback.ResultCode,
    resultDesc: stkCallback.ResultDesc,
    mpesaReceiptNumber: undefined as string | undefined,
    amount: undefined as number | undefined,
    phoneNumber: undefined as string | undefined,
    transactionDate: undefined as string | undefined,
  };

  // Extract metadata if successful
  if (result.success && stkCallback.CallbackMetadata) {
    for (const item of stkCallback.CallbackMetadata.Item) {
      switch (item.Name) {
        case "MpesaReceiptNumber":
          result.mpesaReceiptNumber = String(item.Value);
          break;
        case "Amount":
          result.amount = Number(item.Value);
          break;
        case "PhoneNumber":
          result.phoneNumber = String(item.Value);
          break;
        case "TransactionDate":
          result.transactionDate = String(item.Value);
          break;
      }
    }
  }

  return result;
}

/**
 * Query STK Push transaction status
 */
export interface StkQueryResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
}

/**
 * STK Query Result (normalized for routes)
 */
export interface StkQueryResult {
  success: boolean;
  resultCode: string;
  resultDesc: string;
}

export async function queryStkPushStatus(
  checkoutRequestId: string
): Promise<StkQueryResult> {
  const accessToken = await getAccessToken();
  const timestamp = generateTimestamp();
  const password = generatePassword(timestamp);
  const shortcode = getShortcode();

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  };

  try {
    const response = await fetch(API_URLS[env.MPESA_ENVIRONMENT].stkQuery, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as StkQueryResponse;

    return {
      success: data.ResultCode === "0",
      resultCode: data.ResultCode,
      resultDesc: data.ResultDesc,
    };
  } catch (error) {
    return {
      success: false,
      resultCode: "ERROR",
      resultDesc: error instanceof Error ? error.message : "Query failed",
    };
  }
}
