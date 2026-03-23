import { z } from "zod";

const promptTypeSchema = z.enum([
  "all",
  "buy_token_nudge",
  "failed_purchase_follow_up",
]);

export const customerPromptListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  meterNumber: z.string().trim().min(1).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  phoneNumber: z.string().trim().min(10).max(20).optional(),
  staleDays: z.coerce.number().int().min(1).max(90).optional(),
  type: promptTypeSchema.default("all"),
});

export const customerPromptQueueSchema = customerPromptListQuerySchema.extend({
  maxPrompts: z.coerce.number().int().min(1).max(50).optional(),
});

export type CustomerPromptListQuery = z.infer<
  typeof customerPromptListQuerySchema
>;
export type CustomerPromptQueueInput = z.infer<
  typeof customerPromptQueueSchema
>;
