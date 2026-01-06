import { Elysia, t } from "elysia";
import { db } from "../db";
import { meters, tariffs, motherMeters } from "../db/schema";
import {
  createMeterSchema,
  updateMeterSchema,
  meterQuerySchema,
} from "../validators/meters";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth-middleware";

/**
 * Meter Routes
 *
 * Handles:
 * - CRUD operations for sub-meters
 * - Meter lookup by number
 * - Meter status management
 */
export const meterRoutes = new Elysia({ prefix: "/meters" })
  // Apply auth middleware to this route group
  .use(authMiddleware)

  /**
   * List meters with optional filters (requires auth)
   */
  .get(
    "/",
    async ({ query }) => {
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

      return { data: result, count: result.length };
    },
    {
      query: meterQuerySchema,
      auth: true,
    }
  )

  /**
   * Get meter by ID
   */
  .get(
    "/:id",
    async ({ params, set }) => {
      const meter = await db.query.meters.findFirst({
        where: eq(meters.id, params.id),
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
        set.status = 404;
        return { error: "Meter not found" };
      }

      return { data: meter };
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      auth: true,
    }
  )

  /**
   * Lookup meter by meter number (for validation)
   */
  .get(
    "/lookup/:meterNumber",
    async ({ params, set }) => {
      const meter = await db.query.meters.findFirst({
        where: eq(meters.meterNumber, params.meterNumber),
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
        set.status = 404;
        return { error: "Meter not found", valid: false };
      }

      return {
        valid: meter.status === "active",
        data: meter,
      };
    },
    {
      params: t.Object({
        meterNumber: t.String(),
      }),
      auth: true,
    }
  )

  /**
   * Create new meter
   */
  .post(
    "/",
    async ({ body, set }) => {
      // Verify mother meter exists
      const motherMeter = await db.query.motherMeters.findFirst({
        where: eq(motherMeters.id, body.motherMeterId),
      });

      if (!motherMeter) {
        set.status = 400;
        return { error: "Mother meter not found" };
      }

      // Verify tariff exists
      const tariff = await db.query.tariffs.findFirst({
        where: eq(tariffs.id, body.tariffId),
      });

      if (!tariff) {
        set.status = 400;
        return { error: "Tariff not found" };
      }

      // Check for duplicate meter number
      const existing = await db.query.meters.findFirst({
        where: eq(meters.meterNumber, body.meterNumber),
      });

      if (existing) {
        set.status = 409;
        return { error: "Meter number already exists" };
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

      set.status = 201;
      return { data: meter };
    },
    {
      body: createMeterSchema,
      auth: true,  // Users can register new meters
    }
  )

  /**
   * Update meter
   */
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      // Verify meter exists
      const existing = await db.query.meters.findFirst({
        where: eq(meters.id, params.id),
      });

      if (!existing) {
        set.status = 404;
        return { error: "Meter not found" };
      }

      // If updating tariff, verify it exists
      if (body.tariffId) {
        const tariff = await db.query.tariffs.findFirst({
          where: eq(tariffs.id, body.tariffId),
        });

        if (!tariff) {
          set.status = 400;
          return { error: "Tariff not found" };
        }
      }

      const [updated] = await db
        .update(meters)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(meters.id, params.id))
        .returning();

      return { data: updated };
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: updateMeterSchema,
      auth: true,  // Users can update meter details
    }
  )

  /**
   * Suspend meter
   */
  .post(
    "/:id/suspend",
    async ({ params, set }) => {
      const [updated] = await db
        .update(meters)
        .set({ status: "suspended", updatedAt: new Date() })
        .where(eq(meters.id, params.id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Meter not found" };
      }

      return { data: updated };
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      adminOnly: true,
    }
  )

  /**
   * Activate meter
   */
  .post(
    "/:id/activate",
    async ({ params, set }) => {
      const [updated] = await db
        .update(meters)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(meters.id, params.id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Meter not found" };
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
