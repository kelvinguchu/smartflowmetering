import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { transactions } from "./transactions";

// SMS provider enum
export const smsProviderEnum = pgEnum("sms_provider", [
  "hostpinnacle",
  "textsms",
]);

// SMS status enum
export const smsStatusEnum = pgEnum("sms_status", [
  "queued",
  "sent",
  "delivered",
  "failed",
]);

export const smsLogs = pgTable("sms_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id").references(() => transactions.id, {
    onDelete: "restrict",
  }), // Nullable - not all SMS are for transactions
  phoneNumber: text("phone_number").notNull(),
  messageBody: text("message_body").notNull(),
  provider: smsProviderEnum("provider").notNull(),
  status: smsStatusEnum("status").notNull().default("queued"),
  providerStatus: text("provider_status"),
  providerErrorCode: text("provider_error_code"),
  providerMessageId: text("provider_message_id"), // External ID from provider
  providerReceivedAt: timestamp("provider_received_at", { withTimezone: true }),
  providerDeliveredAt: timestamp("provider_delivered_at", {
    withTimezone: true,
  }),
  cost: numeric("cost", { precision: 8, scale: 4 }), // Provider cost
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const smsLogsRelations = relations(smsLogs, ({ one }) => ({
  transaction: one(transactions, {
    fields: [smsLogs.transactionId],
    references: [transactions.id],
  }),
}));

// Types
export type SmsLog = typeof smsLogs.$inferSelect;
export type NewSmsLog = typeof smsLogs.$inferInsert;
