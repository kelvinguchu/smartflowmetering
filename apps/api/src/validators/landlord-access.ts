import { z } from "zod";
import { landlordAppNotificationTypes } from "../lib/customer-app-notification-types";
import { isAllowedKenyanPhoneNumber } from "../lib/staff-contact";

const landlordPhoneNumberSchema = z.string().refine(isAllowedKenyanPhoneNumber, {
  message: "Phone number must be 0712345678 or 254712345678",
});

export const landlordSendOtpSchema = z.object({
  phoneNumber: landlordPhoneNumberSchema,
});

export const landlordVerifyOtpSchema = z.object({
  code: z.string().trim().min(4).max(10),
  phoneNumber: landlordPhoneNumberSchema,
});

export const landlordDeviceTokenUpsertSchema = z.object({
  platform: z.enum(["android", "ios", "web"]),
  token: z.string().trim().min(20).max(4096),
});

export const landlordNotificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  motherMeterId: z.uuid().optional(),
  offset: z.coerce.number().int().min(0).optional(),
  propertyId: z.uuid().optional(),
  status: z.enum(["failed", "pending", "read", "sent"]).optional(),
  type: z.enum(landlordAppNotificationTypes).optional(),
});

export const landlordNotificationIdParamSchema = z.object({
  id: z.uuid(),
});

export const landlordMotherMeterIdParamSchema = z.object({
  id: z.uuid(),
});

export const landlordPropertyIdParamSchema = z.object({
  id: z.uuid(),
});

export const landlordSubMeterIdParamSchema = z.object({
  id: z.uuid(),
});

export const landlordSubMeterDetailQuerySchema = z.object({
  purchaseLimit: z.coerce.number().int().min(1).max(100).optional(),
});

export const landlordTimelineWindowQuerySchema = z.object({
  endDate: z.iso.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(1000).optional(),
  startDate: z.iso.date().optional(),
});

export const landlordDailyRollupQuerySchema = landlordTimelineWindowQuerySchema;

export const landlordPropertyRollupQuerySchema = landlordTimelineWindowQuerySchema.extend({
  granularity: z.enum(["day", "month", "week"]).default("day"),
  motherMeterType: z.enum(["postpaid", "prepaid"]).optional(),
});

export const landlordPropertyComparisonQuerySchema = landlordTimelineWindowQuerySchema.extend({
  motherMeterType: z.enum(["postpaid", "prepaid"]).optional(),
});

export const landlordPropertyAnalyticsSummaryQuerySchema =
  landlordTimelineWindowQuerySchema.extend({
    motherMeterType: z.enum(["postpaid", "prepaid"]).optional(),
  });

export const landlordThresholdSummaryQuerySchema = z.object({
  daysAfterLastPayment: z.coerce.number().int().min(1).max(60).optional(),
  propertyId: z.uuid().optional(),
});

export const landlordThresholdListQuerySchema = landlordThresholdSummaryQuerySchema.extend({
  includeNominal: z.coerce.boolean().optional(),
});

export const landlordThresholdHistoryQuerySchema = z.object({
  daysAfterLastPayment: z.coerce.number().int().min(1).max(60).optional(),
  endDate: z.iso.date().optional(),
  startDate: z.iso.date().optional(),
});

export const landlordExceptionalStateSummaryQuerySchema = z.object({
  companyPaymentInactivityDays: z.coerce.number().int().min(1).max(365).optional(),
  postpaidOutstandingAmountThreshold: z.coerce.number().min(0).max(1_000_000).optional(),
  propertyId: z.uuid().optional(),
});

export const landlordExceptionalStateListQuerySchema =
  landlordExceptionalStateSummaryQuerySchema.extend({
    includeNominal: z.coerce.boolean().optional(),
  });

export const landlordSummaryQuerySchema = z.object({
  propertyId: z.uuid().optional(),
});

export const landlordMotherMeterListQuerySchema = z.object({
  propertyId: z.uuid().optional(),
});

export const landlordPurchaseListQuerySchema = z.object({
  endDate: z.iso.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  meterNumber: z.string().trim().min(3).max(128).optional(),
  motherMeterNumber: z.string().trim().min(3).max(128).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  propertyId: z.uuid().optional(),
  startDate: z.iso.date().optional(),
  status: z.enum(["completed", "failed", "pending", "processing"]).optional(),
});

export const landlordUsageHistoryQuerySchema = z.object({
  endDate: z.iso.date().optional(),
  limit: z.coerce.number().int().min(1).max(120).optional(),
  meterNumber: z.string().trim().min(3).max(128).optional(),
  motherMeterId: z.uuid().optional(),
  offset: z.coerce.number().int().min(0).optional(),
  propertyId: z.uuid().optional(),
  startDate: z.iso.date().optional(),
});

export const landlordActivityQuerySchema = z.object({
  endDate: z.iso.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  meterNumber: z.string().trim().min(3).max(128).optional(),
  motherMeterId: z.uuid().optional(),
  offset: z.coerce.number().int().min(0).max(1000).optional(),
  propertyId: z.uuid().optional(),
  startDate: z.iso.date().optional(),
  type: z
    .enum(["bill_payment", "initial_deposit", "refill", "tenant_purchase"])
    .optional(),
});

export const landlordTimelineQuerySchema = z.object({
  endDate: z.iso.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  motherMeterId: z.uuid().optional(),
  offset: z.coerce.number().int().min(0).max(1000).optional(),
  propertyId: z.uuid().optional(),
  startDate: z.iso.date().optional(),
});
