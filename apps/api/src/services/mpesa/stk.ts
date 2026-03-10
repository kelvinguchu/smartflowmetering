import { env } from "../../config";
import { getMpesaApiUrls } from "./constants";
import { getAccessToken } from "./auth";
import { generatePassword, generateTimestamp, getShortcode } from "./helpers";
import type {
  StkPushRequest,
  StkPushResponse,
  StkPushResult,
  StkQueryResponse,
  StkQueryResult,
} from "./types";

export async function initiateStkPush(
  request: StkPushRequest
): Promise<StkPushResult> {
  const urls = getMpesaApiUrls(env.MPESA_ENVIRONMENT, env.MPESA_BASE_URL);
  const accessToken = await getAccessToken();
  const timestamp = generateTimestamp();
  const password = generatePassword(timestamp);
  const callbackUrl = request.callbackUrl || env.MPESA_CALLBACK_URL;
  const shortcode = getShortcode();

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: env.MPESA_C2B_COMMAND_ID,
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
    const response = await fetch(urls.stkPush, {
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
      console.error("[M-Pesa STK] Error:", data);
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
    console.error("[M-Pesa STK] Exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export async function queryStkPushStatus(
  checkoutRequestId: string
): Promise<StkQueryResult> {
  const urls = getMpesaApiUrls(env.MPESA_ENVIRONMENT, env.MPESA_BASE_URL);
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
    const response = await fetch(urls.stkQuery, {
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
