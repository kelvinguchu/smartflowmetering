import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const tariffs = pgTable("tariffs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // e.g., 'Domestic Step 1', 'Commercial'
  ratePerKwh: numeric("rate_per_kwh", { precision: 10, scale: 4 }).notNull(),
  currency: text("currency").notNull().default("KES"),
  validFrom: timestamp("valid_from", { withTimezone: true })
    .notNull()
    .defaultNow(),
  validTo: timestamp("valid_to", { withTimezone: true }), // Nullable for current rates
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Relations defined separately to avoid circular imports
export const tariffsRelations = relations(tariffs, ({ many }) => ({
  meters: many(tariffs), // Will be properly linked in schema/index.ts
  motherMeters: many(tariffs),
}));

// Types
export type Tariff = typeof tariffs.$inferSelect;
export type NewTariff = typeof tariffs.$inferInsert;
