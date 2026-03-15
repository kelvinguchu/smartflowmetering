import { z } from "zod";

export const transactionQuerySchema = z.object({
  meterId: z.uuid().optional(),
  meterNumber: z.string().optional(),
  mpesaReceiptNumber: z.string().optional(),
  phoneNumber: z.string().optional(),
  status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
  transactionId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type TransactionQuery = z.infer<typeof transactionQuerySchema>;

export const resendTokenSchema = z.object({
  transactionId: z.uuid(),
  phoneNumber: z.string().optional(),
});

export type ResendToken = z.infer<typeof resendTokenSchema>;
