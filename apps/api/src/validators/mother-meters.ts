import { z } from "zod";

export const motherMeterIdParamSchema = z.object({
  id: z.uuid(),
});

export const motherMeterEventSchema = z.object({
  eventType: z.enum(["initial_deposit", "refill", "bill_payment"]),
  amount: z.coerce.number().positive(),
  kplcToken: z.string().max(120).optional(),
  kplcReceiptNumber: z.string().max(120).optional(),
});

export const motherMeterListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const motherMeterLowBalanceQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  includeAboveThreshold: z.coerce.boolean().optional(),
});

export const motherMeterLowBalanceNotifySchema = z.object({
  maxAlerts: z.coerce.number().int().min(1).max(500).optional(),
});

export const postpaidReminderQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  daysAfterLastPayment: z.coerce.number().int().min(1).max(60).optional(),
  includeNotDue: z.coerce.boolean().optional(),
});

export const postpaidReminderNotifySchema = z.object({
  maxAlerts: z.coerce.number().int().min(1).max(500).optional(),
  daysAfterLastPayment: z.coerce.number().int().min(1).max(60).optional(),
});

export const reconciliationQuerySchema = z.object({
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
});
