import { z } from "zod";

export const smsRecoveryListQuerySchema = z
  .object({
    deliveryState: z.enum(["all", "delivered", "failed", "pending"]).default("failed"),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    meterNumber: z.string().trim().min(1).optional(),
    offset: z.coerce.number().int().min(0).optional(),
    phoneNumber: z.string().trim().min(10).max(20).optional(),
    q: z.string().trim().min(1).optional(),
    transactionId: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.q && !value.phoneNumber && !value.meterNumber && !value.transactionId) {
      ctx.addIssue({
        code: "custom",
        message: "Provide one of q, phoneNumber, meterNumber, or transactionId",
        path: ["q"],
      });
    }
  });

export const smsRecoveryRetryBatchSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(20),
});

export type SmsRecoveryListQuery = z.infer<typeof smsRecoveryListQuerySchema>;
export type SmsRecoveryRetryBatchInput = z.infer<typeof smsRecoveryRetryBatchSchema>;
