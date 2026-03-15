import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";

export const notificationSeverityEnum = pgEnum("notification_severity", [
  "info",
  "warning",
  "critical",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "unread",
  "read",
  "archived",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "mother_meter_low_balance",
  "postpaid_payment_reminder",
  "daily_usage_summary",
  "sms_provider_outage",
]);

export const adminNotifications = pgTable("admin_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: notificationTypeEnum("type").notNull(),
  severity: notificationSeverityEnum("severity").notNull().default("info"),
  status: notificationStatusEnum("status").notNull().default("unread"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
});

export type AdminNotification = typeof adminNotifications.$inferSelect;
export type NewAdminNotification = typeof adminNotifications.$inferInsert;
