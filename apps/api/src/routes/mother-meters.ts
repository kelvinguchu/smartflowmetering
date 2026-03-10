import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { motherMeterEvents, motherMeters } from "../db/schema";
import {
  motherMeterEventSchema,
  motherMeterIdParamSchema,
  motherMeterLowBalanceNotifySchema,
  motherMeterLowBalanceQuerySchema,
  motherMeterListQuerySchema,
  postpaidReminderNotifySchema,
  postpaidReminderQuerySchema,
  reconciliationQuerySchema,
} from "../validators/mother-meters";
import {
  requireAdmin,
  requireAuth,
  type AppBindings,
} from "../lib/auth-middleware";
import { extractClientIp, writeAuditLog } from "../services/audit-log.service";
import {
  computeMotherMeterBalance,
  computeMotherMeterReconciliation,
  listMotherMeterLowBalanceAlerts,
  listPostpaidPaymentReminders,
} from "../services/mother-meter-analytics.service";
import {
  queueLowBalanceNotifications,
  queuePostpaidReminderNotifications,
} from "../services/mother-meter-alerts.service";

export const motherMeterRoutes = new Hono<AppBindings>();

motherMeterRoutes.get(
  "/alerts/low-balance",
  requireAdmin,
  zValidator("query", motherMeterLowBalanceQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const alerts = await listMotherMeterLowBalanceAlerts({
      limit: query.limit,
      offset: query.offset,
      includeAboveThreshold: query.includeAboveThreshold,
    });

    const belowThreshold = alerts.filter((alert) => alert.isBelowThreshold).length;

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
  }
);

motherMeterRoutes.post(
  "/alerts/low-balance/notify",
  requireAdmin,
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
  }
);

motherMeterRoutes.get(
  "/alerts/postpaid-reminders",
  requireAdmin,
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
  }
);

motherMeterRoutes.post(
  "/alerts/postpaid-reminders/notify",
  requireAdmin,
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
  }
);

motherMeterRoutes.get(
  "/",
  requireAuth,
  zValidator("query", motherMeterListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await db.query.motherMeters.findMany({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      orderBy: [desc(motherMeters.createdAt)],
      with: {
        landlord: {
          columns: { id: true, name: true, phoneNumber: true },
        },
        tariff: {
          columns: { id: true, name: true, ratePerKwh: true },
        },
        property: {
          columns: { id: true, name: true, location: true },
        },
      },
    });

    return c.json({ data: result, count: result.length });
  }
);

motherMeterRoutes.get(
  "/:id/events",
  requireAuth,
  zValidator("param", motherMeterIdParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const events = await db.query.motherMeterEvents.findMany({
      where: eq(motherMeterEvents.motherMeterId, id),
      orderBy: [desc(motherMeterEvents.createdAt)],
      limit: 100,
    });

    return c.json({ data: events, count: events.length });
  }
);

motherMeterRoutes.post(
  "/:id/events",
  requireAdmin,
  zValidator("param", motherMeterIdParamSchema),
  zValidator("json", motherMeterEventSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const motherMeter = await db.query.motherMeters.findFirst({
      where: eq(motherMeters.id, id),
      columns: { id: true },
    });

    if (!motherMeter) {
      return c.json({ error: "Mother meter not found" }, 404);
    }

    const user = c.get("user");
    const [event] = await db
      .insert(motherMeterEvents)
      .values({
        motherMeterId: id,
        eventType: body.eventType,
        amount: body.amount.toFixed(2),
        kplcToken: body.kplcToken ?? null,
        kplcReceiptNumber: body.kplcReceiptNumber ?? null,
        performedBy: user.id.match(/^[0-9a-f-]{36}$/i)
          ? user.id
          : "00000000-0000-0000-0000-000000000000",
      })
      .returning();

    await writeAuditLog({
      userId: user.id,
      action: "mother_meter_event_created",
      entityType: "mother_meter_event",
      entityId: event.id,
      details: {
        motherMeterId: id,
        eventType: body.eventType,
        amount: body.amount,
      },
      ipAddress: extractClientIp(c.req.raw.headers),
    });

    return c.json({ data: event }, 201);
  }
);

motherMeterRoutes.get(
  "/:id/balance",
  requireAuth,
  zValidator("param", motherMeterIdParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const motherMeter = await db.query.motherMeters.findFirst({
      where: eq(motherMeters.id, id),
      columns: {
        id: true,
        motherMeterNumber: true,
        type: true,
        lowBalanceThreshold: true,
      },
    });

    if (!motherMeter) {
      return c.json({ error: "Mother meter not found" }, 404);
    }

    const balance = await computeMotherMeterBalance(id);
    const lowBalanceThreshold = toNumber(motherMeter.lowBalanceThreshold);

    return c.json({
      data: {
          motherMeterId: motherMeter.id,
          motherMeterNumber: motherMeter.motherMeterNumber,
          type: motherMeter.type,
          totals: {
          deposits: balance.deposits.toFixed(2),
          billPayments: balance.billPayments.toFixed(2),
          netSales: balance.netSales.toFixed(2),
          estimatedBalance: balance.estimatedBalance.toFixed(2),
        },
        threshold: {
          lowBalance: lowBalanceThreshold.toFixed(2),
          isBelowThreshold: balance.estimatedBalance < lowBalanceThreshold,
        },
      },
    });
  }
);

motherMeterRoutes.get(
  "/:id/reconciliation",
  requireAdmin,
  zValidator("param", motherMeterIdParamSchema),
  zValidator("query", reconciliationQuerySchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const startDate = query.startDate ? new Date(query.startDate) : null;
    const endDate = query.endDate ? new Date(query.endDate) : null;

    const motherMeter = await db.query.motherMeters.findFirst({
      where: eq(motherMeters.id, id),
      columns: { id: true, motherMeterNumber: true, type: true },
    });

    if (!motherMeter) {
      return c.json({ error: "Mother meter not found" }, 404);
    }

    const reconciliation = await computeMotherMeterReconciliation({
      motherMeterId: id,
      startDate,
      endDate,
    });

    return c.json({
      data: {
        motherMeterId: motherMeter.id,
        motherMeterNumber: motherMeter.motherMeterNumber,
        type: motherMeter.type,
        period: {
          startDate: startDate?.toISOString() ?? null,
          endDate: endDate?.toISOString() ?? null,
        },
        netSalesCollected: reconciliation.netSalesCollected.toFixed(2),
        kplcPayments: reconciliation.kplcPayments.toFixed(2),
        variance: reconciliation.variance.toFixed(2),
      },
    });
  }
);

function toNumber(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
