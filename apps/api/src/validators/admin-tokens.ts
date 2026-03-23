import { z } from "zod";

export const adminTokenActionSchema = z.enum([
  "clear_tamper",
  "clear_credit",
  "set_power_limit",
  "key_change",
]);

export const adminTokenDeliverySchema = z.enum(["none", "sms"]);

export const createAdminTokenSchema = z
  .object({
    meterId: z.uuid().optional(),
    meterNumber: z.string().min(1).max(32).optional(),
    action: adminTokenActionSchema,
    reason: z.string().min(8).max(500),
    delivery: adminTokenDeliverySchema.default("none"),
    phoneNumber: z.string().min(10).max(20).optional(),
    power: z.coerce.number().int().positive().optional(),
    sgcId: z.string().min(1).max(64).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.meterId && !value.meterNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either meterId or meterNumber is required",
        path: ["meterId"],
      });
    }

    if (value.action === "set_power_limit" && !value.power) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "power is required for set_power_limit",
        path: ["power"],
      });
    }

    if (value.action !== "set_power_limit" && value.power != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "power is only allowed for set_power_limit",
        path: ["power"],
      });
    }

    if (value.action === "key_change" && !value.sgcId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sgcId is required for key_change",
        path: ["sgcId"],
      });
    }

    if (value.action !== "key_change" && value.sgcId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sgcId is only allowed for key_change",
        path: ["sgcId"],
      });
    }

    if (value.delivery === "sms" && !value.phoneNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "phoneNumber is required when delivery is sms",
        path: ["phoneNumber"],
      });
    }
  });

export type CreateAdminToken = z.infer<typeof createAdminTokenSchema>;
