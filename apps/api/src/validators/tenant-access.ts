import { z } from "zod";
import { tenantAppNotificationTypes } from "../lib/customer-app-notification-types";

export const tenantAccessBootstrapSchema = z.object({
  meterNumber: z.string().trim().min(3).max(128),
});

export const tenantDeviceTokenUpsertSchema = z.object({
  platform: z.enum(["android", "ios", "web"]),
  token: z.string().trim().min(20).max(4096),
});

export const tenantNotificationIdParamSchema = z.object({
  id: z.uuid(),
});

export const tenantTokenDeliveryIdParamSchema = z.object({
  transactionId: z.string().trim().min(3).max(128),
});

export const tenantTokenDeliveryAcknowledgeParamSchema =
  tenantTokenDeliveryIdParamSchema;

export const tenantNotificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  status: z.enum(["failed", "pending", "read", "sent"]).optional(),
  type: z.enum(tenantAppNotificationTypes).optional(),
});

export const tenantPurchaseListQuerySchema = z.object({
  endDate: z.iso.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  startDate: z.iso.date().optional(),
});

export const tenantPurchaseRollupQuerySchema = tenantPurchaseListQuerySchema.extend({
  granularity: z.enum(["day", "month", "week"]).default("day"),
});

export const tenantHistorySummaryQuerySchema = z.object({
  endDate: z.iso.date().optional(),
  startDate: z.iso.date().optional(),
});

export const tenantRecoveryStateQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const tenantTokenDeliveryListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  status: z.enum(["pending_token", "token_available"]).optional(),
});
