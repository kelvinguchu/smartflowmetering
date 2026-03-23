import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { meters, motherMeters, tariffs } from "../db/schema";
import type { AppBindings } from "../lib/auth-middleware";
import { requirePermission } from "../lib/auth-middleware";
import {
  ensureAdminRouteAccess,
  isAdminStaffUser,
} from "../lib/staff-route-access";
import { queueTenantNotificationsForMeter } from "../services/tenant/tenant-notification-producer.service";
import {
  createMeterSchema,
  meterQuerySchema,
  updateMeterSchema,
} from "../validators/meters";

const idParamSchema = z.object({
  id: z.uuid(),
});

const meterNumberParamSchema = z.object({
  meterNumber: z.string(),
});

export const meterRoutes = new Hono<AppBindings>();

meterRoutes.get(
  "/",
  requirePermission("meters:read"),
  zValidator("query", meterQuerySchema),
  async (c) => {
    const actor = c.get("user");
    const query = c.req.valid("query");
    if (!isAdminStaffUser(actor) && !query.meterNumber) {
      ensureAdminRouteAccess(actor, "Broad meter listing");
    }

    const conditions = [];
    if (query.meterNumber) {
      conditions.push(eq(meters.meterNumber, query.meterNumber));
    }
    if (query.status) {
      conditions.push(eq(meters.status, query.status));
    }
    if (query.motherMeterId) {
      conditions.push(eq(meters.motherMeterId, query.motherMeterId));
    }

    const result = await db.query.meters.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        motherMeter: {
          columns: { id: true, motherMeterNumber: true },
        },
        tariff: {
          columns: { id: true, name: true, ratePerKwh: true },
        },
      },
      orderBy: [desc(meters.createdAt)],
      limit: isAdminStaffUser(actor) ? 50 : 10,
    });

    return c.json({ count: result.length, data: result });
  },
);

meterRoutes.get(
  "/:id",
  requirePermission("meters:read"),
  zValidator("param", idParamSchema),
  async (c) => {
    ensureAdminRouteAccess(c.get("user"), "Meter detail access by internal ID");

    const { id } = c.req.valid("param");
    const meter = await db.query.meters.findFirst({
      where: eq(meters.id, id),
      with: {
        motherMeter: {
          with: {
            landlord: true,
            property: true,
          },
        },
        tariff: true,
      },
    });

    if (!meter) {
      return c.json({ error: "Meter not found" }, 404);
    }

    return c.json({ data: meter });
  },
);

meterRoutes.get(
  "/lookup/:meterNumber",
  requirePermission("meters:read"),
  zValidator("param", meterNumberParamSchema),
  async (c) => {
    const { meterNumber } = c.req.valid("param");
    const meter = await db.query.meters.findFirst({
      where: eq(meters.meterNumber, meterNumber),
      columns: {
        brand: true,
        id: true,
        meterNumber: true,
        meterType: true,
        status: true,
      },
      with: {
        tariff: {
          columns: { id: true, name: true, ratePerKwh: true },
        },
      },
    });

    if (!meter) {
      return c.json({ error: "Meter not found", valid: false }, 404);
    }

    return c.json({
      data: meter,
      valid: meter.status === "active",
    });
  },
);

meterRoutes.post(
  "/",
  requirePermission("meters:write"),
  zValidator("json", createMeterSchema),
  async (c) => {
    const body = c.req.valid("json");
    const motherMeter = await db.query.motherMeters.findFirst({
      where: eq(motherMeters.id, body.motherMeterId),
    });
    if (!motherMeter) {
      return c.json({ error: "Mother meter not found" }, 400);
    }

    const tariff = await db.query.tariffs.findFirst({
      where: eq(tariffs.id, body.tariffId),
    });
    if (!tariff) {
      return c.json({ error: "Tariff not found" }, 400);
    }

    const existing = await db.query.meters.findFirst({
      where: eq(meters.meterNumber, body.meterNumber),
    });
    if (existing) {
      return c.json({ error: "Meter number already exists" }, 409);
    }

    const [meter] = await db
      .insert(meters)
      .values({
        brand: body.brand,
        keyRevisionNumber: body.keyRevisionNumber ?? 1,
        meterNumber: body.meterNumber,
        meterType: body.meterType,
        motherMeterId: body.motherMeterId,
        supplyGroupCode: body.supplyGroupCode,
        tariffId: body.tariffId,
        tariffIndex: body.tariffIndex ?? 1,
      })
      .returning();

    return c.json({ data: meter }, 201);
  },
);

meterRoutes.patch(
  "/:id",
  requirePermission("meters:write"),
  zValidator("param", idParamSchema),
  zValidator("json", updateMeterSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const existing = await db.query.meters.findFirst({
      where: eq(meters.id, id),
    });
    if (!existing) {
      return c.json({ error: "Meter not found" }, 404);
    }

    if (body.tariffId) {
      const tariff = await db.query.tariffs.findFirst({
        where: eq(tariffs.id, body.tariffId),
      });
      if (!tariff) {
        return c.json({ error: "Tariff not found" }, 400);
      }
    }

    const [updated] = await db
      .update(meters)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(meters.id, id))
      .returning();

    if (body.status && body.status !== existing.status) {
      await queueMeterStatusNotification(updated, existing.status);
    }

    return c.json({ data: updated });
  },
);

meterRoutes.post(
  "/:id/suspend",
  requirePermission("meters:status"),
  zValidator("param", idParamSchema),
  async (c) => {
    const updated = await updateMeterStatus(c.req.valid("param").id, "suspended");
    if (!updated) {
      return c.json({ error: "Meter not found" }, 404);
    }

    await queueMeterStatusNotification(updated, "active");
    return c.json({ data: updated });
  },
);

meterRoutes.post(
  "/:id/activate",
  requirePermission("meters:status"),
  zValidator("param", idParamSchema),
  async (c) => {
    const updated = await updateMeterStatus(c.req.valid("param").id, "active");
    if (!updated) {
      return c.json({ error: "Meter not found" }, 404);
    }

    await queueMeterStatusNotification(updated, "suspended");
    return c.json({ data: updated });
  },
);

async function updateMeterStatus(id: string, status: "active" | "suspended") {
  const [updated] = await db
    .update(meters)
    .set({ status, updatedAt: new Date() })
    .where(eq(meters.id, id))
    .returning();

  return updated ?? null;
}

async function queueMeterStatusNotification(
  meter: {
    id: string;
    meterNumber: string;
    status: string;
    updatedAt: Date;
  },
  previousStatus: string,
) {
  await queueTenantNotificationsForMeter({
    meterId: meter.id,
    meterNumber: meter.meterNumber,
    meterStatus: meter.status,
    metadata: { previousStatus },
    referenceId: `${meter.id}:${meter.updatedAt.toISOString()}`,
    type: "meter_status_alert",
  });
}

