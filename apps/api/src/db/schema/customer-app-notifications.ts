import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const customerAppNotificationTypeEnum = pgEnum(
  "customer_app_notification_type",
  ["buy_token_nudge", "failed_purchase_follow_up"],
);

export const customerAppNotificationStatusEnum = pgEnum(
  "customer_app_notification_status",
  ["pending", "sent", "read", "failed"],
);

export const customerAppNotifications = pgTable(
  "customer_app_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: customerAppNotificationTypeEnum("type").notNull(),
    status: customerAppNotificationStatusEnum("status")
      .notNull()
      .default("pending"),
    phoneNumber: text("phone_number").notNull(),
    meterNumber: text("meter_number").notNull(),
    referenceId: text("reference_id").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata"),
    deliveryAttempts: integer("delivery_attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastFailureCode: text("last_failure_code"),
    lastFailureMessage: text("last_failure_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
);

export type CustomerAppNotification =
  typeof customerAppNotifications.$inferSelect;
export type NewCustomerAppNotification =
  typeof customerAppNotifications.$inferInsert;
