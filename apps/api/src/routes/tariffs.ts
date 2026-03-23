import { zValidator } from "@hono/zod-validator";
import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { tariffs } from "../db/schema";
import { requirePermission } from "../lib/auth-middleware";
import type { AppBindings } from "../lib/auth-middleware";
import { createTariffSchema, updateTariffSchema } from "../validators/tariffs";

const idParamSchema = z.object({
  id: z.uuid(),
});

export const tariffRoutes = new Hono<AppBindings>();

tariffRoutes.get("/", requirePermission("tariffs:read"), async (c) => {
  const now = new Date();

  const result = await db.query.tariffs.findMany({
    where: and(
      lte(tariffs.validFrom, now),
      or(isNull(tariffs.validTo), gte(tariffs.validTo, now))
    ),
    orderBy: (currentTariffs, { asc }) => [asc(currentTariffs.name)],
  });

  return c.json({ data: result, count: result.length });
});

tariffRoutes.get("/all", requirePermission("tariffs:manage"), async (c) => {
  const result = await db.query.tariffs.findMany({
    orderBy: (currentTariffs, { desc }) => [desc(currentTariffs.createdAt)],
  });

  return c.json({ data: result, count: result.length });
});

tariffRoutes.get(
  "/:id",
  requirePermission("tariffs:read"),
  zValidator("param", idParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const tariff = await db.query.tariffs.findFirst({
      where: eq(tariffs.id, id),
    });

    if (!tariff) {
      return c.json({ error: "Tariff not found" }, 404);
    }

    return c.json({ data: tariff });
  }
);

tariffRoutes.post(
  "/",
  requirePermission("tariffs:manage"),
  zValidator("json", createTariffSchema),
  async (c) => {
    const body = c.req.valid("json");
    const [tariff] = await db
      .insert(tariffs)
      .values({
        name: body.name,
        ratePerKwh: body.ratePerKwh,
        currency: body.currency ?? "KES",
        validFrom: body.validFrom ? new Date(body.validFrom) : new Date(),
        validTo: body.validTo ? new Date(body.validTo) : null,
      })
      .returning();

    return c.json({ data: tariff }, 201);
  }
);

tariffRoutes.patch(
  "/:id",
  requirePermission("tariffs:manage"),
  zValidator("param", idParamSchema),
  zValidator("json", updateTariffSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const existing = await db.query.tariffs.findFirst({
      where: eq(tariffs.id, id),
    });

    if (!existing) {
      return c.json({ error: "Tariff not found" }, 404);
    }

    const updateData: Partial<typeof tariffs.$inferInsert> = {};

    if (body.name) {
      updateData.name = body.name;
    }
    if (body.ratePerKwh) {
      updateData.ratePerKwh = body.ratePerKwh;
    }
    if (body.validTo) {
      updateData.validTo = new Date(body.validTo);
    }

    const [updated] = await db
      .update(tariffs)
      .set(updateData)
      .where(eq(tariffs.id, id))
      .returning();

    return c.json({ data: updated });
  }
);

tariffRoutes.post(
  "/:id/expire",
  requirePermission("tariffs:manage"),
  zValidator("param", idParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const updatedTariffs = await db
      .update(tariffs)
      .set({ validTo: new Date() })
      .where(eq(tariffs.id, id))
      .returning();

    if (updatedTariffs.length === 0) {
      return c.json({ error: "Tariff not found" }, 404);
    }

    const updated = updatedTariffs[0];
    return c.json({ data: updated });
  }
);
