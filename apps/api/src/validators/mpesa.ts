import { z } from "zod";

const stringOrNumberSchema = z.union([z.string(), z.number()]);

export const mpesaC2BCallbackSchema = z.object({
  TransactionType: z.string(),
  TransID: z.string(),
  TransTime: z.string(),
  TransAmount: stringOrNumberSchema,
  BusinessShortCode: z.string(),
  BillRefNumber: z.string(),
  InvoiceNumber: z.string().optional(),
  OrgAccountBalance: stringOrNumberSchema.optional(),
  ThirdPartyTransID: z.string().optional(),
  MSISDN: z.string(),
  FirstName: z.string().optional(),
  MiddleName: z.string().optional(),
  LastName: z.string().optional(),
});

export type MpesaC2BCallback = z.infer<typeof mpesaC2BCallbackSchema>;

export const mpesaValidationSchema = z.object({
  TransactionType: z.string(),
  TransID: z.string(),
  TransTime: z.string(),
  TransAmount: stringOrNumberSchema,
  BusinessShortCode: z.string(),
  BillRefNumber: z.string(),
  InvoiceNumber: z.string().optional(),
  OrgAccountBalance: stringOrNumberSchema.optional(),
  ThirdPartyTransID: z.string().optional(),
  MSISDN: z.string(),
  FirstName: z.string().optional(),
  MiddleName: z.string().optional(),
  LastName: z.string().optional(),
});

export type MpesaValidation = z.infer<typeof mpesaValidationSchema>;

export const stkPushRequestSchema = z.object({
  phoneNumber: z.string().min(10).max(15),
  amount: z.number().positive(),
  meterNumber: z.string().min(1).optional(),
  accountReference: z.string().min(1).optional(),
  transactionDesc: z.string().optional(),
});

export type StkPushRequest = z.infer<typeof stkPushRequestSchema>;

export const stkPushCallbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string(),
      CheckoutRequestID: z.string(),
      ResultCode: z.number(),
      ResultDesc: z.string(),
      CallbackMetadata: z
        .object({
          Item: z.array(
            z.object({
              Name: z.string(),
              Value: stringOrNumberSchema.optional(),
            })
          ),
        })
        .optional(),
    }),
  }),
});

export type StkPushCallback = z.infer<typeof stkPushCallbackSchema>;

export const stkPushQuerySchema = z.object({
  checkoutRequestId: z.string(),
});

export type StkPushQuery = z.infer<typeof stkPushQuerySchema>;
