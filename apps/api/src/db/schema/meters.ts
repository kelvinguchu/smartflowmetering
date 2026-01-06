import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { motherMeters } from "./mother-meters";
import { tariffs } from "./tariffs";

// Meter type enum
export const meterTypeEnum = pgEnum("meter_type", [
  "electricity",
  "water",
  "gas",
]);

// Meter brand enum
export const meterBrandEnum = pgEnum("meter_brand", [
  "hexing",
  "stron",
  "conlog",
]);

// Meter status enum
export const meterStatusEnum = pgEnum("meter_status", [
  "active",
  "inactive",
  "suspended",
]);

export const meters = pgTable("meters", {
  id: uuid("id").primaryKey().defaultRandom(),
  meterNumber: text("meter_number").notNull().unique(),
  meterType: meterTypeEnum("meter_type").notNull(),
  brand: meterBrandEnum("brand").notNull(),
  motherMeterId: uuid("mother_meter_id")
    .notNull()
    .references(() => motherMeters.id, { onDelete: "restrict" }),
  tariffId: uuid("tariff_id")
    .notNull()
    .references(() => tariffs.id, { onDelete: "restrict" }),
  // STS Token Generation Parameters (Critical)
  supplyGroupCode: text("supply_group_code").notNull(), // SGC - Critical for STS tokens
  keyRevisionNumber: integer("key_revision_number").notNull().default(1), // KRN - e.g., 1 or 2
  tariffIndex: integer("tariff_index").notNull().default(1), // TI - e.g., 01
  status: meterStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const metersRelations = relations(meters, ({ one, many }) => ({
  motherMeter: one(motherMeters, {
    fields: [meters.motherMeterId],
    references: [motherMeters.id],
  }),
  tariff: one(tariffs, {
    fields: [meters.tariffId],
    references: [tariffs.id],
  }),
  transactions: many(meters), // Will be linked in index.ts
  generatedTokens: many(meters), // Will be linked in index.ts
}));

// Types
export type Meter = typeof meters.$inferSelect;
export type NewMeter = typeof meters.$inferInsert;
