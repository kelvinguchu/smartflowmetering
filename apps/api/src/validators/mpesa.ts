import { t } from "elysia";

// M-Pesa C2B Callback payload schema
// Reference: Safaricom Daraja API documentation
export const mpesaC2BCallbackSchema = t.Object({
  TransactionType: t.String(),
  TransID: t.String(), // M-Pesa Receipt Number
  TransTime: t.String(), // Format: YYYYMMDDHHmmss
  TransAmount: t.Union([t.String(), t.Number()]), // Amount paid
  BusinessShortCode: t.String(), // Paybill number
  BillRefNumber: t.String(), // Account number (meter number)
  InvoiceNumber: t.Optional(t.String()),
  OrgAccountBalance: t.Optional(t.Union([t.String(), t.Number()])),
  ThirdPartyTransID: t.Optional(t.String()),
  MSISDN: t.String(), // Phone number (254...)
  FirstName: t.Optional(t.String()),
  MiddleName: t.Optional(t.String()),
  LastName: t.Optional(t.String()),
});

export type MpesaC2BCallback = typeof mpesaC2BCallbackSchema.static;

// M-Pesa Validation Request (for URL validation)
export const mpesaValidationSchema = t.Object({
  TransactionType: t.String(),
  TransID: t.String(),
  TransTime: t.String(),
  TransAmount: t.Union([t.String(), t.Number()]),
  BusinessShortCode: t.String(),
  BillRefNumber: t.String(),
  InvoiceNumber: t.Optional(t.String()),
  OrgAccountBalance: t.Optional(t.Union([t.String(), t.Number()])),
  ThirdPartyTransID: t.Optional(t.String()),
  MSISDN: t.String(),
  FirstName: t.Optional(t.String()),
  MiddleName: t.Optional(t.String()),
  LastName: t.Optional(t.String()),
});

export type MpesaValidation = typeof mpesaValidationSchema.static;

// STK Push Request Schema
export const stkPushRequestSchema = t.Object({
  phoneNumber: t.String({ minLength: 10, maxLength: 15 }), // 254XXXXXXXXX or 07XXXXXXXX
  amount: t.Number({ minimum: 1 }),
  meterNumber: t.Optional(t.String({ minLength: 1 })), // Optional meter number
  accountReference: t.Optional(t.String({ minLength: 1 })), // Optional account reference
  transactionDesc: t.Optional(t.String()), // Optional description
});

export type StkPushRequest = typeof stkPushRequestSchema.static;

// STK Push Callback Schema (from Safaricom)
export const stkPushCallbackSchema = t.Object({
  Body: t.Object({
    stkCallback: t.Object({
      MerchantRequestID: t.String(),
      CheckoutRequestID: t.String(),
      ResultCode: t.Number(),
      ResultDesc: t.String(),
      CallbackMetadata: t.Optional(
        t.Object({
          Item: t.Array(
            t.Object({
              Name: t.String(),
              Value: t.Optional(t.Union([t.String(), t.Number()])),
            })
          ),
        })
      ),
    }),
  }),
});

export type StkPushCallback = typeof stkPushCallbackSchema.static;

// STK Push Query Schema
export const stkPushQuerySchema = t.Object({
  checkoutRequestId: t.String(),
});

export type StkPushQuery = typeof stkPushQuerySchema.static;
