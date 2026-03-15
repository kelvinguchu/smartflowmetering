import { relations } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customerAppNotifications } from "./customer-app-notifications";
import { customerDeviceTokens } from "./customer-device-tokens";
import { meters } from "./meters";

export const tenantAppAccessStatusEnum = pgEnum("tenant_app_access_status", [
  "active",
  "revoked",
]);

export const tenantAppAccesses = pgTable("tenant_app_accesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  meterId: uuid("meter_id")
    .notNull()
    .references(() => meters.id, { onDelete: "cascade" }),
  accessTokenHash: text("access_token_hash").notNull().unique(),
  status: tenantAppAccessStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const tenantAppAccessesRelations = relations(
  tenantAppAccesses,
  ({ many, one }) => ({
    meter: one(meters, {
      fields: [tenantAppAccesses.meterId],
      references: [meters.id],
    }),
    notifications: many(customerAppNotifications),
    deviceTokens: many(customerDeviceTokens),
  }),
);

export type TenantAppAccess = typeof tenantAppAccesses.$inferSelect;
export type NewTenantAppAccess = typeof tenantAppAccesses.$inferInsert;
