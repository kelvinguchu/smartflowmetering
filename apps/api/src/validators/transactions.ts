import { t } from "elysia";

// Transaction query params
export const transactionQuerySchema = t.Object({
  meterId: t.Optional(t.String({ format: "uuid" })),
  meterNumber: t.Optional(t.String()),
  phoneNumber: t.Optional(t.String()),
  status: t.Optional(
    t.Union([
      t.Literal("pending"),
      t.Literal("processing"),
      t.Literal("completed"),
      t.Literal("failed"),
    ])
  ),
  startDate: t.Optional(t.String({ format: "date-time" })),
  endDate: t.Optional(t.String({ format: "date-time" })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
  offset: t.Optional(t.Number({ minimum: 0, default: 0 })),
});

export type TransactionQuery = typeof transactionQuerySchema.static;

// Resend token request
export const resendTokenSchema = t.Object({
  transactionId: t.String({ format: "uuid" }),
  phoneNumber: t.Optional(t.String()), // Override phone if needed
});

export type ResendToken = typeof resendTokenSchema.static;
