import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { meters, motherMeters, tariffs } from "../db/schema";
import type { AppBindings } from "../lib/auth-middleware";
import {
  requirePermission,
} from "../lib/auth-middleware";
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
    const query = c.req.valid("query");
    const conditions = [];

    if (query.status) {
      conditions.push(eq(meters.status, query.status));
    }
    if (query.motherMeterId) {
      conditions.push(eq(meters.motherMeterId, query.motherMeterId));
    }

    const result = await db.query.meters.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        tariff: {
          columns: { id: true, name: true, ratePerKwh: true },
        },
        motherMeter: {
          columns: { id: true, motherMeterNumber: true },
        },
      },
      orderBy: [desc(meters.createdAt)],
      limit: 50,
    });

    return c.json({ data: result, count: result.length });
  }
);

meterRoutes.get(
  "/:id",
  requirePermission("meters:read"),
  zValidator("param", idParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const meter = await db.query.meters.findFirst({
      where: eq(meters.id, id),
      with: {
        tariff: true,
        motherMeter: {
          with: {
            property: true,
            landlord: true,
          },
        },
      },
    });

    if (!meter) {
      return c.json({ error: "Meter not found" }, 404);
    }

    return c.json({ data: meter });
  }
);

meterRoutes.get(
  "/lookup/:meterNumber",
  requirePermission("meters:read"),
  zValidator("param", meterNumberParamSchema),
  async (c) => {
    const { meterNumber } = c.req.valid("param");
    const meter = await db.query.meters.findFirst({
      where: eq(meters.meterNumber, meterNumber),
      with: {
        tariff: {
          columns: { id: true, name: true, ratePerKwh: true },
        },
      },
      columns: {
        id: true,
        meterNumber: true,
        meterType: true,
        brand: true,
        status: true,
      },
    });

    if (!meter) {
      return c.json({ error: "Meter not found", valid: false }, 404);
    }

    return c.json({
      valid: meter.status === "active",
      data: meter,
    });
  }
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
        meterNumber: body.meterNumber,
        meterType: body.meterType,
        brand: body.brand,
        motherMeterId: body.motherMeterId,
        tariffId: body.tariffId,
        supplyGroupCode: body.supplyGroupCode,
        keyRevisionNumber: body.keyRevisionNumber ?? 1,
        tariffIndex: body.tariffIndex ?? 1,
      })
      .returning();

    return c.json({ data: meter }, 201);
  }
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
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(meters.id, id))
      .returning();

    return c.json({ data: updated });
  }
);

meterRoutes.post(
  "/:id/suspend",
  requirePermission("meters:status"),
  zValidator("param", idParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const updatedRows = await db
      .update(meters)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(meters.id, id))
      .returning();
    if (updatedRows.length === 0) {
      return c.json({ error: "Meter not found" }, 404);
    }

    return c.json({ data: updatedRows[0] });
  }
);

meterRoutes.post(
  "/:id/activate",
  requirePermission("meters:status"),
  zValidator("param", idParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const updatedRows = await db
      .update(meters)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(meters.id, id))
      .returning();
    if (updatedRows.length === 0) {
      return c.json({ error: "Meter not found" }, 404);
    }

    return c.json({ data: updatedRows[0] });
  }
);
