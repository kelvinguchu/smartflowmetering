import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppBindings } from "../lib/auth-middleware";
import { requirePermission } from "../lib/auth-middleware";
import {
  queueLowBalanceNotifications,
  queuePostpaidReminderNotifications,
} from "../services/mother-meter-alerts.service";
import {
  listMotherMeterLowBalanceAlerts,
  listPostpaidPaymentReminders,
} from "../services/mother-meter-analytics.service";
import {
  motherMeterLowBalanceNotifySchema,
  motherMeterLowBalanceQuerySchema,
  postpaidReminderNotifySchema,
  postpaidReminderQuerySchema,
} from "../validators/mother-meters";

export const motherMeterAlertRoutes = new Hono<AppBindings>();

motherMeterAlertRoutes.get(
  "/low-balance",
  requirePermission("mother_meter_alerts:manage"),
  zValidator("query", motherMeterLowBalanceQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const alerts = await listMotherMeterLowBalanceAlerts({
      limit: query.limit,
      offset: query.offset,
      includeAboveThreshold: query.includeAboveThreshold,
    });

    const belowThreshold = alerts.filter(
      (alert) => alert.isBelowThreshold,
    ).length;

    return c.json({
      data: alerts.map((alert) => ({
        ...alert,
        estimatedBalance: alert.estimatedBalance.toFixed(2),
        lowBalanceThreshold: alert.lowBalanceThreshold.toFixed(2),
      })),
      count: alerts.length,
      summary: {
        belowThreshold,
      },
    });
  },
);

motherMeterAlertRoutes.post(
  "/low-balance/notify",
  requirePermission("mother_meter_alerts:manage"),
  zValidator("json", motherMeterLowBalanceNotifySchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await queueLowBalanceNotifications({
      maxAlerts: body.maxAlerts,
    });

    return c.json({
      message: "Low-balance admin notifications generated",
      ...result,
    });
  },
);

motherMeterAlertRoutes.get(
  "/postpaid-reminders",
  requirePermission("mother_meter_alerts:manage"),
  zValidator("query", postpaidReminderQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const reminders = await listPostpaidPaymentReminders({
      limit: query.limit,
      offset: query.offset,
      daysAfterLastPayment: query.daysAfterLastPayment,
      includeNotDue: query.includeNotDue,
    });

    const dueCount = reminders.filter((item) => item.isReminderDue).length;

    return c.json({
      data: reminders.map((item) => ({
        ...item,
        lastBillPaymentAt: item.lastBillPaymentAt?.toISOString() ?? null,
        reminderDate: item.reminderDate?.toISOString() ?? null,
      })),
      count: reminders.length,
      summary: {
        dueCount,
      },
    });
  },
);

motherMeterAlertRoutes.post(
  "/postpaid-reminders/notify",
  requirePermission("mother_meter_alerts:manage"),
  zValidator("json", postpaidReminderNotifySchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await queuePostpaidReminderNotifications({
      maxAlerts: body.maxAlerts,
      daysAfterLastPayment: body.daysAfterLastPayment,
    });

    return c.json({
      message: "Postpaid reminder admin notifications generated",
      ...result,
    });
  },
);
