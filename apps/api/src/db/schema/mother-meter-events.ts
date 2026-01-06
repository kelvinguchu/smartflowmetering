import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { motherMeters } from "./mother-meters";

// Event type enum
export const motherMeterEventTypeEnum = pgEnum("mother_meter_event_type", [
  "initial_deposit",
  "refill",
  "bill_payment",
]);

export const motherMeterEvents = pgTable("mother_meter_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  motherMeterId: uuid("mother_meter_id")
    .notNull()
    .references(() => motherMeters.id, { onDelete: "restrict" }),
  eventType: motherMeterEventTypeEnum("event_type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), // Amount paid to KPLC
  kplcToken: text("kplc_token"), // For prepaid refills
  kplcReceiptNumber: text("kplc_receipt_number"), // Reference
  performedBy: uuid("performed_by").notNull(), // FK to users (admin who did the action)
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const motherMeterEventsRelations = relations(
  motherMeterEvents,
  ({ one }) => ({
    motherMeter: one(motherMeters, {
      fields: [motherMeterEvents.motherMeterId],
      references: [motherMeters.id],
    }),
  })
);

// Types
export type MotherMeterEvent = typeof motherMeterEvents.$inferSelect;
export type NewMotherMeterEvent = typeof motherMeterEvents.$inferInsert;
