import { t } from "elysia";

// Create tariff schema
export const createTariffSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  ratePerKwh: t.String(), // Stored as string to preserve decimal precision
  currency: t.Optional(t.String({ default: "KES" })),
  validFrom: t.Optional(t.String({ format: "date-time" })),
  validTo: t.Optional(t.String({ format: "date-time" })),
});

export type CreateTariff = typeof createTariffSchema.static;

// Update tariff schema
export const updateTariffSchema = t.Partial(
  t.Object({
    name: t.String({ minLength: 1, maxLength: 100 }),
    ratePerKwh: t.String(),
    validTo: t.String({ format: "date-time" }),
  })
);

export type UpdateTariff = typeof updateTariffSchema.static;
