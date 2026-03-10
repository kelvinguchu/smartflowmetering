import { z } from "zod";

export const failedTransactionIdParamSchema = z.object({
  id: z.uuid(),
});

export const failedTransactionListQuerySchema = z.object({
  status: z
    .enum(["pending_review", "refunded", "resolved", "abandoned"])
    .optional(),
  failureReason: z
    .enum([
      "invalid_meter",
      "below_minimum",
      "manufacturer_error",
      "sms_failed",
      "meter_inactive",
      "other",
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const failedTransactionUpdateSchema = z.object({
  status: z.enum(["pending_review", "refunded", "resolved", "abandoned"]),
  resolutionNotes: z.string().max(500).optional(),
});
