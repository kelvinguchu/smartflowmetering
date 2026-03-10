import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "../db";
import { adminNotifications } from "../db/schema";

type NotificationType =
  | "mother_meter_low_balance"
  | "postpaid_payment_reminder"
  | "daily_usage_summary";
type NotificationSeverity = "info" | "warning" | "critical";

export interface CreateAdminNotificationInput {
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface ListAdminNotificationsOptions {
  status?: "unread" | "read" | "archived";
  limit?: number;
  offset?: number;
}

export async function createAdminNotification(
  input: CreateAdminNotificationInput
) {
  const [created] = await db
    .insert(adminNotifications)
    .values({
      type: input.type,
      severity: input.severity,
      title: input.title,
      message: input.message,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
    })
    .returning();
  return created;
}

export async function listAdminNotifications(
  options: ListAdminNotificationsOptions = {}
) {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const rows = await db.query.adminNotifications.findMany({
    where: options.status
      ? eq(adminNotifications.status, options.status)
      : undefined,
    orderBy: [desc(adminNotifications.createdAt)],
    limit,
    offset,
  });

  return {
    data: rows,
    count: rows.length,
    limit,
    offset,
  };
}

export async function markAdminNotificationRead(id: string) {
  const [updated] = await db
    .update(adminNotifications)
    .set({
      status: "read",
      readAt: new Date(),
    })
    .where(eq(adminNotifications.id, id))
    .returning();
  return updated ?? null;
}

export async function markAllAdminNotificationsRead() {
  const updated = await db
    .update(adminNotifications)
    .set({
      status: "read",
      readAt: new Date(),
    })
    .where(eq(adminNotifications.status, "unread"))
    .returning({ id: adminNotifications.id });

  return {
    updated: updated.length,
  };
}

export async function hasRecentAdminNotification(input: {
  type: NotificationType;
  entityId: string;
  dedupeWindowHours: number;
}) {
  const cutoff = new Date(Date.now() - input.dedupeWindowHours * 3_600_000);
  const [existing] = await db
    .select({ id: adminNotifications.id })
    .from(adminNotifications)
    .where(
      and(
        eq(adminNotifications.type, input.type),
        eq(adminNotifications.entityId, input.entityId),
        gte(adminNotifications.createdAt, cutoff)
      )
    )
    .limit(1);

  return Boolean(existing);
}
