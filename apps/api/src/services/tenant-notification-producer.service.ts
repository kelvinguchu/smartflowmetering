import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  customerAppNotifications,
  tenantAppAccesses,
} from "../db/schema";
import type { CustomerAppNotificationType } from "../lib/customer-app-notification-types";
import { formatTenantAppNotification } from "../lib/tenant-app-notification-formatters";
import { enqueueCustomerAppNotificationDelivery } from "./app-notifications.service";

export async function queueTenantNotificationsForMeter(input: {
  amountPaid?: string;
  meterId: string;
  meterNumber: string;
  meterStatus?: string;
  metadata?: Record<string, string | null>;
  referenceId: string;
  type: Extract<
    CustomerAppNotificationType,
    "meter_status_alert" | "token_delivery_available" | "token_purchase_recorded"
  >;
  unitsPurchased?: string;
}) {
  const tenantAccessRows = await db.query.tenantAppAccesses.findMany({
    where: and(
      eq(tenantAppAccesses.meterId, input.meterId),
      eq(tenantAppAccesses.status, "active"),
    ),
    columns: { id: true },
  });
  if (tenantAccessRows.length === 0) {
    return { created: 0 };
  }

  const tenantAccessIds = tenantAccessRows.map((row) => row.id);
  const existingRows = await db.query.customerAppNotifications.findMany({
    where: and(
      inArray(customerAppNotifications.tenantAccessId, tenantAccessIds),
      eq(customerAppNotifications.referenceId, input.referenceId),
      eq(customerAppNotifications.type, input.type),
    ),
    columns: { tenantAccessId: true },
  });
  const existingTenantIds = new Set(
    existingRows
      .map((row) => row.tenantAccessId)
      .filter((value): value is string => value !== null),
  );

  const content = formatTenantAppNotification({
    amountPaid: input.amountPaid,
    meterNumber: input.meterNumber,
    meterStatus: input.meterStatus,
    type: input.type,
    unitsPurchased: input.unitsPurchased,
  });
  let created = 0;

  for (const tenantAccessId of tenantAccessIds) {
    if (existingTenantIds.has(tenantAccessId)) {
      continue;
    }

    const [notification] = await db
      .insert(customerAppNotifications)
      .values({
        message: content.message,
        metadata: {
          amountPaid: input.amountPaid ?? null,
          ...input.metadata,
          unitsPurchased: input.unitsPurchased ?? null,
        },
        meterNumber: input.meterNumber,
        referenceId: input.referenceId,
        tenantAccessId,
        title: content.title,
        type: input.type,
      })
      .returning({ id: customerAppNotifications.id });

    await enqueueCustomerAppNotificationDelivery(notification.id);
    created += 1;
  }

  return { created };
}
