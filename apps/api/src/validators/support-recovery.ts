import { z } from "zod";

export const supportRecoveryQuerySchema = z
  .object({
    meterNumber: z.string().trim().min(1).optional(),
    mpesaReceiptNumber: z.string().trim().min(1).optional(),
    phoneNumber: z.string().trim().min(10).max(20).optional(),
    q: z.string().trim().min(1).optional(),
    transactionId: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      !value.q &&
      !value.phoneNumber &&
      !value.meterNumber &&
      !value.transactionId &&
      !value.mpesaReceiptNumber
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Provide one of q, phoneNumber, meterNumber, transactionId, or mpesaReceiptNumber",
        path: ["q"],
      });
    }
  });

export type SupportRecoveryQuery = z.infer<typeof supportRecoveryQuerySchema>;
