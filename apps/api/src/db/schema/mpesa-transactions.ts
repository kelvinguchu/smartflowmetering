import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

// Transaction status enum values
export const MPESA_STATUS = {
  PENDING: "pending",
  RECEIVED: "received",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type MpesaStatus = (typeof MPESA_STATUS)[keyof typeof MPESA_STATUS];

// Raw log of all M-Pesa callbacks - stored as-is for debugging/auditing
export const mpesaTransactions = pgTable("mpesa_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionType: text("transaction_type").notNull(), // e.g., 'Pay Bill', 'CustomerPayBillOnline', 'STK_PUSH'
  transId: text("trans_id").notNull().unique(), // M-Pesa Receipt - Unique constraint for idempotency
  transTime: text("trans_time").notNull(), // Raw timestamp from M-Pesa
  transAmount: numeric("trans_amount", { precision: 12, scale: 2 }).notNull(),
  businessShortCode: text("business_short_code").notNull(),
  billRefNumber: text("bill_ref_number").notNull(), // Account Number entered by user (meter number)
  invoiceNumber: text("invoice_number"),
  orgAccountBalance: numeric("org_account_balance", {
    precision: 14,
    scale: 2,
  }),
  thirdPartyTransId: text("third_party_trans_id"),
  msisdn: text("msisdn").notNull(), // Phone number
  firstName: text("first_name"),
  middleName: text("middle_name"),
  lastName: text("last_name"),
  // Status for tracking STK Push and processing state
  status: text("status").$type<MpesaStatus>().default("received").notNull(),
  // Store full original JSON for debugging
  rawPayload: jsonb("raw_payload"),
  // Legacy field for backward compatibility
  rawCallbackPayload: jsonb("raw_callback_payload"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Types
export type MpesaTransaction = typeof mpesaTransactions.$inferSelect;
export type NewMpesaTransaction = typeof mpesaTransactions.$inferInsert;
