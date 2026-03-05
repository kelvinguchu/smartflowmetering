import { z } from "zod";

export const transactionQuerySchema = z.object({
  meterId: z.string().uuid().optional(),
  meterNumber: z.string().optional(),
  phoneNumber: z.string().optional(),
  status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type TransactionQuery = z.infer<typeof transactionQuerySchema>;

export const resendTokenSchema = z.object({
  transactionId: z.string().uuid(),
  phoneNumber: z.string().optional(),
});

export type ResendToken = z.infer<typeof resendTokenSchema>;
