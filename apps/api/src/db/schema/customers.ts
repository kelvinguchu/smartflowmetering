import { relations } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

// Customer type enum
export const customerTypeEnum = pgEnum("customer_type", ["tenant", "landlord"]);

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(), // Better Auth user ids are text, not uuid
  phoneNumber: text("phone_number").notNull().unique(), // Primary identifier for M-Pesa
  name: text("name").notNull(),
  customerType: customerTypeEnum("customer_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const customersRelations = relations(customers, ({ many }) => ({
  properties: many(customers), // Will be linked in index.ts
  motherMeters: many(customers),
}));

// Types
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
