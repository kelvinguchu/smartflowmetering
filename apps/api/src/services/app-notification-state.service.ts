import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { customerAppNotifications } from "../db/schema";

export async function getCustomerAppNotificationById(id: string) {
  return db.query.customerAppNotifications.findFirst({
    where: eq(customerAppNotifications.id, id),
  });
}

export async function recordCustomerAppNotificationAttempt(
  notificationId: string,
): Promise<void> {
  await db
    .update(customerAppNotifications)
    .set({
      deliveryAttempts: sql`${customerAppNotifications.deliveryAttempts} + 1`,
      lastAttemptAt: new Date(),
    } as { deliveryAttempts: ReturnType<typeof sql>; lastAttemptAt: Date })
    .where(eq(customerAppNotifications.id, notificationId));
}

export async function recordCustomerAppNotificationRetryableFailure(
  notificationId: string,
  input: { code: string; message: string },
): Promise<void> {
  await db
    .update(customerAppNotifications)
    .set({
      lastFailureCode: input.code,
      lastFailureMessage: input.message,
    })
    .where(eq(customerAppNotifications.id, notificationId));
}

export async function markCustomerAppNotificationFailed(
  notificationId: string,
  input: { code: string; message: string },
): Promise<void> {
  await db
    .update(customerAppNotifications)
    .set({
      lastFailureCode: input.code,
      lastFailureMessage: input.message,
      status: "failed",
    })
    .where(eq(customerAppNotifications.id, notificationId));
}

export async function markCustomerAppNotificationSent(
  notificationId: string,
): Promise<void> {
  await db
    .update(customerAppNotifications)
    .set({
      lastFailureCode: null,
      lastFailureMessage: null,
      sentAt: new Date(),
      status: "sent",
    })
    .where(eq(customerAppNotifications.id, notificationId));
}

export async function resetCustomerAppNotificationForRetry(
  notificationId: string,
): Promise<void> {
  await db
    .update(customerAppNotifications)
    .set({
      lastFailureCode: null,
      lastFailureMessage: null,
      status: "pending",
    })
    .where(eq(customerAppNotifications.id, notificationId));
}
