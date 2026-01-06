import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

// Audit logs for security & compliance - tracks all sensitive actions
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(), // FK to Better-Auth users table
  action: text("action").notNull(), // e.g., 'update_tariff', 'generate_tamper_token', 'refill_mother_meter'
  entityType: text("entity_type").notNull(), // e.g., 'tariff', 'meter', 'mother_meter'
  entityId: text("entity_id").notNull(),
  details: jsonb("details"), // Previous values, new values
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Types
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
