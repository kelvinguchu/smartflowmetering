import type { ParsedStkCallback, StkPushCallback } from "./types";

export function parseStkCallback(callback: StkPushCallback): ParsedStkCallback {
  const { stkCallback } = callback.Body;

  const result: ParsedStkCallback = {
    success: stkCallback.ResultCode === 0,
    checkoutRequestId: stkCallback.CheckoutRequestID,
    merchantRequestId: stkCallback.MerchantRequestID,
    resultCode: stkCallback.ResultCode,
    resultDesc: stkCallback.ResultDesc,
  };

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
