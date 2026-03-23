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
  resolutionAction: z
    .enum([
      "abandoned_after_customer_follow_up",
      "customer_advised_to_retry_above_minimum",
      "customer_confirmed_correct_meter_for_retry",
      "manual_review_documented",
      "meter_status_follow_up_completed",
      "provider_issue_reviewed_for_retry_or_refund",
      "refund_completed",
      "token_resent_or_delivered_via_alternate_channel",
    ])
    .optional(),
  status: z.enum(["pending_review", "refunded", "resolved", "abandoned"]),
  resolutionNotes: z.string().max(500).optional(),
});
