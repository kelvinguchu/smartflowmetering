import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  pgEnum,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { mpesaTransactions } from "./mpesa-transactions";

// Failure reason enum
export const failureReasonEnum = pgEnum("failure_reason", [
  "invalid_meter",
  "below_minimum",
  "manufacturer_error",
  "sms_failed",
  "meter_inactive",
  "other",
]);

// Failed transaction status enum
export const failedTransactionStatusEnum = pgEnum("failed_transaction_status", [
  "pending_review",
  "refunded",
  "resolved",
  "abandoned",
]);

export const failedTransactions = pgTable("failed_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  mpesaTransactionId: uuid("mpesa_transaction_id").notNull(),
  failureReason: failureReasonEnum("failure_reason").notNull(),
  failureDetails: text("failure_details"), // Detailed error message
  meterNumberAttempted: text("meter_number_attempted").notNull(), // What the user entered
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  phoneNumber: text("phone_number").notNull(),
  status: failedTransactionStatusEnum("status")
    .notNull()
    .default("pending_review"),
  resolvedBy: uuid("resolved_by"), // FK to users (nullable)
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (table) => [
  foreignKey({
    name: "failed_tx_mpesa_tx_fk",
    columns: [table.mpesaTransactionId],
    foreignColumns: [mpesaTransactions.id],
  }).onDelete("restrict"),
]);

export const failedTransactionsRelations = relations(
  failedTransactions,
  ({ one }) => ({
    mpesaTransaction: one(mpesaTransactions, {
      fields: [failedTransactions.mpesaTransactionId],
      references: [mpesaTransactions.id],
    }),
  })
);

// Types
export type FailedTransaction = typeof failedTransactions.$inferSelect;
export type NewFailedTransaction = typeof failedTransactions.$inferInsert;
