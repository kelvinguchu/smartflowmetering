import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { meters } from "./meters";
import { mpesaTransactions } from "./mpesa-transactions";

// Transaction status enum
export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

// Payment method enum
export const paymentMethodEnum = pgEnum("payment_method", [
  "paybill",
  "stk_push",
  "ussd",
]);

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: text("transaction_id").notNull().unique(), // OHM-xxx format
  meterId: uuid("meter_id")
    .notNull()
    .references(() => meters.id, { onDelete: "restrict" }),
  mpesaTransactionId: uuid("mpesa_transaction_id").references(
    () => mpesaTransactions.id,
    { onDelete: "restrict" }
  ),
  phoneNumber: text("phone_number").notNull(), // Customer phone
  mpesaReceiptNumber: text("mpesa_receipt_number").notNull().unique(), // Unique constraint for idempotency
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull(), // Gross amount
  commissionAmount: numeric("commission_amount", {
    precision: 12,
    scale: 2,
  }).notNull(), // 10% of amount
  netAmount: numeric("net_amount", { precision: 12, scale: 2 }).notNull(), // 90% to landlord/utility
  rateUsed: numeric("rate_used", { precision: 10, scale: 4 }).notNull(), // KPLC rate at time of purchase (snapshot)
  unitsPurchased: numeric("units_purchased", {
    precision: 12,
    scale: 4,
  }).notNull(), // Calculated: net_amount / rate_used
  status: transactionStatusEnum("status").notNull().default("pending"),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const transactionsRelations = relations(
  transactions,
  ({ one, many }) => ({
    meter: one(meters, {
      fields: [transactions.meterId],
      references: [meters.id],
    }),
    mpesaTransaction: one(mpesaTransactions, {
      fields: [transactions.mpesaTransactionId],
      references: [mpesaTransactions.id],
    }),
    generatedTokens: many(transactions), // Will be linked in index.ts
    smsLogs: many(transactions), // Will be linked in index.ts
  })
);

// Types
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
