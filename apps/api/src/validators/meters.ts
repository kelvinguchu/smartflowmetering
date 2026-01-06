import { t } from "elysia";

// Create meter schema
export const createMeterSchema = t.Object({
  meterNumber: t.String({ minLength: 6, maxLength: 20 }),
  meterType: t.Union([
    t.Literal("electricity"),
    t.Literal("water"),
    t.Literal("gas"),
  ]),
  brand: t.Union([
    t.Literal("hexing"),
    t.Literal("stron"),
    t.Literal("conlog"),
  ]),
  motherMeterId: t.String({ format: "uuid" }),
  tariffId: t.String({ format: "uuid" }),
  supplyGroupCode: t.String({ minLength: 1 }), // SGC - Critical for STS tokens
  keyRevisionNumber: t.Optional(t.Number({ minimum: 1, maximum: 9 })),
  tariffIndex: t.Optional(t.Number({ minimum: 1, maximum: 99 })),
});

export type CreateMeter = typeof createMeterSchema.static;

// Update meter schema
export const updateMeterSchema = t.Partial(
  t.Object({
    tariffId: t.String({ format: "uuid" }),
    supplyGroupCode: t.String({ minLength: 1 }),
    keyRevisionNumber: t.Number({ minimum: 1, maximum: 9 }),
    tariffIndex: t.Number({ minimum: 1, maximum: 99 }),
    status: t.Union([
      t.Literal("active"),
      t.Literal("inactive"),
      t.Literal("suspended"),
    ]),
  })
);

export type UpdateMeter = typeof updateMeterSchema.static;

// Query params for meter lookup
export const meterQuerySchema = t.Object({
  meterNumber: t.Optional(t.String()),
  status: t.Optional(
    t.Union([
      t.Literal("active"),
      t.Literal("inactive"),
      t.Literal("suspended"),
    ])
  ),
  motherMeterId: t.Optional(t.String({ format: "uuid" })),
});

export type MeterQuery = typeof meterQuerySchema.static;
