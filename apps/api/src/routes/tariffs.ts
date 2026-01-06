import { Elysia, t } from "elysia";
import { db } from "../db";
import { tariffs } from "../db/schema";
import { createTariffSchema, updateTariffSchema } from "../validators/tariffs";
import { eq, isNull, and, or, gte, lte } from "drizzle-orm";
import { authMiddleware } from "../lib/auth-middleware";

/**
 * Tariff Routes
 *
 * Handles:
 * - CRUD operations for tariffs
 * - Rate management with historical tracking
 */
export const tariffRoutes = new Elysia({ prefix: "/tariffs" })
  .use(authMiddleware)

  /**
   * List all active tariffs (requires auth)
   */
  .get("/", async () => {
    const now = new Date();

    // Get tariffs that are currently valid
    const result = await db.query.tariffs.findMany({
      where: and(
        lte(tariffs.validFrom, now),
        or(isNull(tariffs.validTo), gte(tariffs.validTo, now))
      ),
      orderBy: (tariffs, { asc }) => [asc(tariffs.name)],
    });

    return { data: result, count: result.length };
  }, { auth: true })

  /**
   * List all tariffs including expired (adminOnly)
   */
  .get("/all", async () => {
    const result = await db.query.tariffs.findMany({
      orderBy: (tariffs, { desc }) => [desc(tariffs.createdAt)],
    });

    return { data: result, count: result.length };
  }, { adminOnly: true })

  /**
   * Get tariff by ID
   */
  .get(
    "/:id",
    async ({ params, set }) => {
      const tariff = await db.query.tariffs.findFirst({
        where: eq(tariffs.id, params.id),
      });

      if (!tariff) {
        set.status = 404;
        return { error: "Tariff not found" };
      }

      return { data: tariff };
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      auth: true,
    }
  )

  /**
   * Create new tariff
   */
  .post(
    "/",
    async ({ body, set }) => {
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

      set.status = 201;
      return { data: tariff };
    },
    {
      body: createTariffSchema,
      adminOnly: true,
    }
  )

  /**
   * Update tariff
   * Note: For rate changes, it's better to create a new tariff and expire the old one
   */
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const existing = await db.query.tariffs.findFirst({
        where: eq(tariffs.id, params.id),
      });

      if (!existing) {
        set.status = 404;
        return { error: "Tariff not found" };
      }

      const updateData: Partial<typeof tariffs.$inferInsert> = {};

      if (body.name) updateData.name = body.name;
      if (body.ratePerKwh) updateData.ratePerKwh = body.ratePerKwh;
      if (body.validTo) updateData.validTo = new Date(body.validTo);

      const [updated] = await db
        .update(tariffs)
        .set(updateData)
        .where(eq(tariffs.id, params.id))
        .returning();

      return { data: updated };
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: updateTariffSchema,
      adminOnly: true,
    }
  )

  /**
   * Expire a tariff (set validTo to now)
   */
  .post(
    "/:id/expire",
    async ({ params, set }) => {
      const [updated] = await db
        .update(tariffs)
        .set({ validTo: new Date() })
        .where(eq(tariffs.id, params.id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Tariff not found" };
      }

      return { data: updated };
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      adminOnly: true,
    }
  );
