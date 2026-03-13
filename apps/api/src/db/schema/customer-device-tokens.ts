import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const customerDevicePlatformEnum = pgEnum("customer_device_platform", [
  "android",
  "ios",
  "web",
]);

export const customerDeviceTokenStatusEnum = pgEnum(
  "customer_device_token_status",
  ["active", "inactive"],
);

export const customerDeviceTokens = pgTable("customer_device_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  phoneNumber: text("phone_number").notNull(),
  token: text("token").notNull().unique(),
  platform: customerDevicePlatformEnum("platform").notNull(),
  status: customerDeviceTokenStatusEnum("status").notNull().default("active"),
  invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
  invalidationReason: text("invalidation_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CustomerDeviceToken = typeof customerDeviceTokens.$inferSelect;
export type NewCustomerDeviceToken = typeof customerDeviceTokens.$inferInsert;
