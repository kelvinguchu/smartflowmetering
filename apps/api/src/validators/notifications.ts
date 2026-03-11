import { z } from "zod";

export const notificationListQuerySchema = z.object({
  status: z.enum(["unread", "read", "archived"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const notificationIdParamSchema = z.object({
  id: z.uuid(),
});

export const runAlertsBodySchema = z.object({
  maxAlerts: z.coerce.number().int().min(1).max(500).optional(),
  daysAfterLastPayment: z.coerce.number().int().min(1).max(60).optional(),
});

export const runDailyUsageBodySchema = z.object({
  date: z.iso.date().optional(),
  maxLandlords: z.coerce.number().int().min(1).max(1000).optional(),
  timezone: z
    .string()
    .min(1)
    .max(100)
    .refine(
      (tz) => {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      },
      { message: "Invalid IANA timezone" },
    )
    .optional(),
});
