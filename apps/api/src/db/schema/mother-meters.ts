import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { customers } from "./customers";
import { properties } from "./properties";
import { tariffs } from "./tariffs";

// Mother meter type enum
export const motherMeterTypeEnum = pgEnum("mother_meter_type", [
  "prepaid",
  "postpaid",
]);

export const motherMeters = pgTable("mother_meters", {
  id: uuid("id").primaryKey().defaultRandom(),
  motherMeterNumber: text("mother_meter_number").notNull().unique(), // KPLC meter number
  type: motherMeterTypeEnum("type").notNull(),
  landlordId: uuid("landlord_id")
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  tariffId: uuid("tariff_id")
    .notNull()
    .references(() => tariffs.id, { onDelete: "restrict" }),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  totalCapacity: numeric("total_capacity", { precision: 10, scale: 2 }), // kW
  lowBalanceThreshold: numeric("low_balance_threshold", {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default("1000"), // KES - Triggers alert
  billingPeriodStart: integer("billing_period_start").default(1), // Day of month for postpaid
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Note: current_balance is NOT stored - calculated on-the-fly:
// Balance = SUM(mother_meter_events.amount) - SUM(transactions.net_amount WHERE meter.mother_meter_id = this)

export const motherMetersRelations = relations(
  motherMeters,
  ({ one, many }) => ({
    landlord: one(customers, {
      fields: [motherMeters.landlordId],
      references: [customers.id],
    }),
    tariff: one(tariffs, {
      fields: [motherMeters.tariffId],
      references: [tariffs.id],
    }),
    property: one(properties, {
      fields: [motherMeters.propertyId],
      references: [properties.id],
    }),
    meters: many(motherMeters), // Sub-meters - will be linked in index.ts
    events: many(motherMeters), // Mother meter events - will be linked in index.ts
  })
);

// Types
export type MotherMeter = typeof motherMeters.$inferSelect;
export type NewMotherMeter = typeof motherMeters.$inferInsert;
