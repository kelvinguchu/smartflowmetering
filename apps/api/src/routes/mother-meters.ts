import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { motherMeterEvents, motherMeters } from "../db/schema";
import type { AppBindings } from "../lib/auth-middleware";
import { requirePermission } from "../lib/auth-middleware";
import { extractClientIp, writeAuditLog } from "../services/audit-log.service";
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
  },
);

motherMeterRoutes.get(
  "/:id/events",
  requirePermission("mother_meters:read"),
  zValidator("param", motherMeterIdParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const events = await db.query.motherMeterEvents.findMany({
      where: eq(motherMeterEvents.motherMeterId, id),
      orderBy: [desc(motherMeterEvents.createdAt)],
      limit: 100,
    });

    return c.json({ data: events, count: events.length });
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
        motherMeterId: id,
        eventType: body.eventType,
        amount: body.amount.toFixed(2),
        kplcToken: body.kplcToken ?? null,
        kplcReceiptNumber: body.kplcReceiptNumber ?? null,
        performedBy: new RegExp(/^[0-9a-f-]{36}$/i).exec(user.id)
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
  },
);

motherMeterRoutes.get(
  "/:id/balance",
  requirePermission("mother_meters:read"),
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
  },
);

function toNumber(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
