import { z } from "zod";

export const appNotificationListQuerySchema = z.object({
  landlordId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  phoneNumber: z.string().trim().min(10).max(20).optional(),
  status: z.enum(["pending", "sent", "read", "failed"]).optional(),
});

export const customerDeviceTokenUpsertSchema = z
  .object({
    landlordId: z.uuid().optional(),
    phoneNumber: z.string().trim().min(10).max(20).optional(),
    platform: z.enum(["android", "ios", "web"]),
    token: z.string().trim().min(20).max(4096),
  })
  .refine(
    (value) =>
      (value.landlordId !== undefined && value.phoneNumber === undefined) ||
      (value.landlordId === undefined && value.phoneNumber !== undefined),
    {
      message: "Provide exactly one of landlordId or phoneNumber",
      path: ["landlordId"],
    },
  );

export const customerDeviceTokenListQuerySchema = z.object({
  landlordId: z.uuid().optional(),
  phoneNumber: z.string().trim().min(10).max(20).optional(),
});

export const appNotificationIdParamSchema = z.object({
  id: z.uuid(),
});
