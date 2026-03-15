import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { motherMeterEvents, motherMeters } from "../db/schema";
import type { AppBindings } from "../lib/auth-middleware";
import { requirePermission } from "../lib/auth-middleware";
import { ensureAdminRouteAccess } from "../lib/staff-route-access";
import { extractClientIp, writeAuditLog } from "../services/audit-log.service";
import { queueLandlordMotherMeterEventAppNotification } from "../services/landlord-notification-producer.service";
import {
  computeMotherMeterBalance,
  computeMotherMeterReconciliation,
} from "../services/mother-meter-analytics.service";
import {
  motherMeterEventSchema,
  motherMeterIdParamSchema,
  motherMeterListQuerySchema,
  reconciliationQuerySchema,
} from "../validators/mother-meters";
import { motherMeterAlertRoutes } from "./mother-meter-alert-routes";

export const motherMeterRoutes = new Hono<AppBindings>();

motherMeterRoutes.route("/alerts", motherMeterAlertRoutes);

motherMeterRoutes.get(
  "/",
  requirePermission("mother_meters:read"),
  zValidator("query", motherMeterListQuerySchema),
  async (c) => {
    ensureAdminRouteAccess(c.get("user"), "Mother meter listing");

    const query = c.req.valid("query");
    const result = await db.query.motherMeters.findMany({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      orderBy: [desc(motherMeters.createdAt)],
      with: {
        landlord: {
          columns: { id: true, name: true, phoneNumber: true },
        },
        property: {
          columns: { id: true, location: true, name: true },
        },
        tariff: {
          columns: { id: true, name: true, ratePerKwh: true },
        },
      },
    });

    return c.json({ count: result.length, data: result });
  },
);

motherMeterRoutes.get(
  "/:id/events",
  requirePermission("mother_meters:read"),
  zValidator("param", motherMeterIdParamSchema),
  async (c) => {
    ensureAdminRouteAccess(c.get("user"), "Mother meter event history");

    const { id } = c.req.valid("param");
    const events = await db.query.motherMeterEvents.findMany({
      where: eq(motherMeterEvents.motherMeterId, id),
      orderBy: [desc(motherMeterEvents.createdAt)],
      limit: 100,
    });

    return c.json({ count: events.length, data: events });
  },
);

motherMeterRoutes.post(
  "/:id/events",
  requirePermission("mother_meters:events:create"),
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
        amount: body.amount.toFixed(2),
        eventType: body.eventType,
        kplcReceiptNumber: body.kplcReceiptNumber ?? null,
        kplcToken: body.kplcToken ?? null,
        motherMeterId: id,
        performedBy: /^[0-9a-f-]{36}$/i.test(user.id)
          ? user.id
          : "00000000-0000-0000-0000-000000000000",
      })
      .returning();

    await writeAuditLog({
      action: "mother_meter_event_created",
      details: {
        amount: body.amount,
        eventType: body.eventType,
        motherMeterId: id,
      },
      entityId: event.id,
      entityType: "mother_meter_event",
      ipAddress: extractClientIp(c.req.raw.headers),
      userId: user.id,
    });
    await queueLandlordMotherMeterEventAppNotification({
      amount: body.amount.toFixed(2),
      eventType: body.eventType,
      motherMeterId: id,
      referenceId: event.id,
    });

    return c.json({ data: event }, 201);
  },
);

motherMeterRoutes.get(
  "/:id/balance",
  requirePermission("mother_meters:read"),
  zValidator("param", motherMeterIdParamSchema),
  async (c) => {
    ensureAdminRouteAccess(c.get("user"), "Mother meter balance access");

    const { id } = c.req.valid("param");
    const motherMeter = await db.query.motherMeters.findFirst({
      where: eq(motherMeters.id, id),
      columns: {
        id: true,
        lowBalanceThreshold: true,
        motherMeterNumber: true,
        type: true,
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
        threshold: {
          isBelowThreshold: balance.estimatedBalance < lowBalanceThreshold,
          lowBalance: lowBalanceThreshold.toFixed(2),
        },
        totals: {
          billPayments: balance.billPayments.toFixed(2),
          deposits: balance.deposits.toFixed(2),
          estimatedBalance: balance.estimatedBalance.toFixed(2),
          netSales: balance.netSales.toFixed(2),
        },
        type: motherMeter.type,
      },
    });
  },
);

motherMeterRoutes.get(
  "/:id/reconciliation",
  requirePermission("mother_meters:reconciliation:read"),
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
      endDate,
      motherMeterId: id,
      startDate,
    });

    return c.json({
      data: {
        kplcPayments: reconciliation.kplcPayments.toFixed(2),
        motherMeterId: motherMeter.id,
        motherMeterNumber: motherMeter.motherMeterNumber,
        netSalesCollected: reconciliation.netSalesCollected.toFixed(2),
        period: {
          endDate: endDate?.toISOString() ?? null,
          startDate: startDate?.toISOString() ?? null,
        },
        type: motherMeter.type,
        variance: reconciliation.variance.toFixed(2),
      },
    });
  },
);

function toNumber(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
