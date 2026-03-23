import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  customerAppNotifications,
  meters,
  motherMeters,
  properties,
  tenantAppAccesses,
} from "../../db/schema";
import type { TenantAppNotificationType } from "../../lib/customer-app-notification-types";
import {
  createTenantAccessToken,
  hashTenantAccessToken,
} from "../../lib/tenant-access-token";
import { toPublicCustomerAppNotification } from "../customer/mobile-public-response.service";
import type {
  TenantAccessSummary,
  TenantMeterSummary,
} from "./tenant-access.types";

export async function bootstrapTenantAccess(meterNumber: string) {
  const meter = await getActiveTenantMeterSummaryByNumber(meterNumber);
  if (meter === undefined) {
    return null;
  }

  const accessToken = createTenantAccessToken();
  const [tenantAccess] = await db
    .insert(tenantAppAccesses)
    .values({
      accessTokenHash: hashTenantAccessToken(accessToken),
      meterId: meter.meterId,
      lastSeenAt: new Date(),
    })
    .returning({ id: tenantAppAccesses.id });

  return {
    accessToken,
    tenantAccess: {
      id: tenantAccess.id,
      meter,
    },
  };
}

export async function getTenantAccessByToken(
  token: string,
): Promise<TenantAccessSummary | null> {
  const tenantAccessRows = await db
    .select({
      accessId: tenantAppAccesses.id,
      meterId: meters.id,
      meterNumber: meters.meterNumber,
      meterType: meters.meterType,
      motherMeterId: motherMeters.id,
      motherMeterNumber: motherMeters.motherMeterNumber,
      propertyId: properties.id,
      propertyName: properties.name,
    })
    .from(tenantAppAccesses)
    .innerJoin(meters, eq(tenantAppAccesses.meterId, meters.id))
    .innerJoin(motherMeters, eq(meters.motherMeterId, motherMeters.id))
    .innerJoin(properties, eq(motherMeters.propertyId, properties.id))
    .where(
      and(
        eq(tenantAppAccesses.accessTokenHash, hashTenantAccessToken(token)),
        eq(tenantAppAccesses.status, "active"),
      ),
    );
  if (tenantAccessRows.length === 0) {
    return null;
  }
  const tenantAccess = tenantAccessRows[0];

  return {
    id: tenantAccess.accessId,
    meterId: tenantAccess.meterId,
    meterNumber: tenantAccess.meterNumber,
    meterType: tenantAccess.meterType,
    motherMeterId: tenantAccess.motherMeterId,
    motherMeterNumber: tenantAccess.motherMeterNumber,
    propertyId: tenantAccess.propertyId,
    propertyName: tenantAccess.propertyName,
  };
}

export async function markTenantNotificationRead(
  tenantAccessId: string,
  notificationId: string,
) {
  const notification = await db.query.customerAppNotifications.findFirst({
    where: eq(customerAppNotifications.id, notificationId),
  });
  if (notification?.tenantAccessId !== tenantAccessId) {
    return null;
  }

  const [updated] = await db
    .update(customerAppNotifications)
    .set({
      readAt: notification.readAt ?? new Date(),
      status: "read",
    })
    .where(eq(customerAppNotifications.id, notificationId))
    .returning();

  return toPublicCustomerAppNotification(updated);
}

export async function acknowledgeTenantTokenDelivery(
  tenantAccessId: string,
  transactionReference: string,
) {
  const notifications = await db.query.customerAppNotifications.findMany({
    where: and(
      eq(customerAppNotifications.tenantAccessId, tenantAccessId),
      eq(customerAppNotifications.referenceId, transactionReference),
      eq(customerAppNotifications.type, "token_delivery_available"),
    ),
    columns: {
      id: true,
      readAt: true,
    },
  });
  if (notifications.length === 0) {
    return null;
  }

  const now = new Date();
  await db
    .update(customerAppNotifications)
    .set({
      readAt: now,
      status: "read",
    })
    .where(
      and(
        eq(customerAppNotifications.tenantAccessId, tenantAccessId),
        eq(customerAppNotifications.referenceId, transactionReference),
        eq(customerAppNotifications.type, "token_delivery_available"),
      ),
    );

  return {
    acknowledgedCount: notifications.length,
    acknowledgedAt: now.toISOString(),
    transactionId: transactionReference,
  };
}

export async function listTenantNotifications(
  tenantAccessId: string,
  input: {
    limit?: number;
    offset?: number;
    status?: "failed" | "pending" | "read" | "sent";
    type?: TenantAppNotificationType;
  },
) {
  const notifications = await db.query.customerAppNotifications.findMany({
    where: buildTenantNotificationFilter(tenantAccessId, input),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
    limit: input.limit ?? 20,
    offset: input.offset ?? 0,
  });

  return notifications.map(toPublicCustomerAppNotification);
}

export async function touchTenantAccess(tenantAccessId: string): Promise<void> {
  await db
    .update(tenantAppAccesses)
    .set({ lastSeenAt: new Date() })
    .where(eq(tenantAppAccesses.id, tenantAccessId));
}

async function getActiveTenantMeterSummaryByNumber(
  meterNumber: string,
): Promise<TenantMeterSummary | undefined> {
  const [meter] = await db
    .select({
      meterId: meters.id,
      meterNumber: meters.meterNumber,
      meterType: meters.meterType,
      motherMeterId: motherMeters.id,
      motherMeterNumber: motherMeters.motherMeterNumber,
      propertyId: properties.id,
      propertyName: properties.name,
    })
    .from(meters)
    .innerJoin(motherMeters, eq(meters.motherMeterId, motherMeters.id))
    .innerJoin(properties, eq(motherMeters.propertyId, properties.id))
    .where(
      and(eq(meters.meterNumber, meterNumber), eq(meters.status, "active")),
    );

  return meter;
}

function buildTenantNotificationFilter(
  tenantAccessId: string,
  input: {
    status?: "failed" | "pending" | "read" | "sent";
    type?: TenantAppNotificationType;
  },
) {
  const filters = [
    eq(customerAppNotifications.tenantAccessId, tenantAccessId),
    input.status
      ? eq(customerAppNotifications.status, input.status)
      : undefined,
    input.type ? eq(customerAppNotifications.type, input.type) : undefined,
  ].filter((value) => value !== undefined);

  return filters.length === 1 ? filters[0] : and(...filters);
}

