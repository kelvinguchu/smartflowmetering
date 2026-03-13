import { z } from "zod";

export const appNotificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  phoneNumber: z.string().trim().min(10).max(20).optional(),
  status: z.enum(["pending", "sent", "read", "failed"]).optional(),
});

export const customerDeviceTokenUpsertSchema = z.object({
  phoneNumber: z.string().trim().min(10).max(20),
  platform: z.enum(["android", "ios", "web"]),
  token: z.string().trim().min(20).max(4096),
});

export const customerDeviceTokenListQuerySchema = z.object({
  phoneNumber: z.string().trim().min(10).max(20).optional(),
});

export const appNotificationIdParamSchema = z.object({
  id: z.uuid(),
});
