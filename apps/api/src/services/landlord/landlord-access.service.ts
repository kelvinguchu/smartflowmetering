import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  customerAppNotifications,
  customers,
  motherMeters,
  properties,
} from "../../db/schema";
import {
  landlordAppNotificationTypes,
} from "../../lib/customer-app-notification-types";
import type { LandlordAppNotificationType } from "../../lib/customer-app-notification-types";
import { toPublicCustomerAppNotification } from "../customer/mobile-public-response.service";
import type {
  LandlordAccessSummary,
  LandlordMotherMeterSummary,
  LandlordPropertySummary,
} from "./landlord-access.types";

export async function getLandlordAccessByUserId(
  userId: string,
): Promise<LandlordAccessSummary | null> {
  const rows = await db
    .select({
      customerId: customers.id,
      customerName: customers.name,
      phoneNumber: customers.phoneNumber,
      propertyId: properties.id,
      propertyLocation: properties.location,
      propertyName: properties.name,
      motherMeterId: motherMeters.id,
      motherMeterNumber: motherMeters.motherMeterNumber,
      motherMeterType: motherMeters.type,
    })
    .from(customers)
    .leftJoin(properties, eq(properties.landlordId, customers.id))
    .leftJoin(motherMeters, eq(motherMeters.landlordId, customers.id))
    .where(
      and(
        eq(customers.customerType, "landlord"),
        eq(customers.userId, userId),
      ),
    );
  if (rows.length === 0) {
    return null;
  }

  const propertiesById = new Map<string, LandlordPropertySummary>();
  const motherMetersById = new Map<string, LandlordMotherMeterSummary>();

  for (const row of rows) {
    if (row.propertyId && !propertiesById.has(row.propertyId)) {
      propertiesById.set(row.propertyId, {
        id: row.propertyId,
        location: row.propertyLocation ?? "",
        name: row.propertyName ?? "",
      });
    }

    if (row.motherMeterId && !motherMetersById.has(row.motherMeterId)) {
      motherMetersById.set(row.motherMeterId, {
        id: row.motherMeterId,
        motherMeterNumber: row.motherMeterNumber ?? "",
        propertyId: row.propertyId ?? "",
        type: row.motherMeterType ?? "prepaid",
      });
    }
  }

  const [firstRow] = rows;
  return {
    customerId: firstRow.customerId,
    motherMeters: Array.from(motherMetersById.values()),
    name: firstRow.customerName,
    phoneNumber: firstRow.phoneNumber,
    properties: Array.from(propertiesById.values()),
    userId,
  };
}

export async function listLandlordNotifications(
  landlordId: string,
  input: {
    limit?: number;
    motherMeterId?: string;
    offset?: number;
    propertyId?: string;
    status?: "failed" | "pending" | "read" | "sent";
    type?: LandlordAppNotificationType;
  },
) {
  const filters = [
    eq(customerAppNotifications.landlordId, landlordId),
    inArray(customerAppNotifications.type, landlordAppNotificationTypes),
    input.status
      ? eq(customerAppNotifications.status, input.status)
      : undefined,
    input.type ? eq(customerAppNotifications.type, input.type) : undefined,
    input.motherMeterId
      ? sql`coalesce(${customerAppNotifications.metadata}->>'motherMeterId', '') = ${input.motherMeterId}`
      : undefined,
    input.propertyId
      ? sql`coalesce(${customerAppNotifications.metadata}->>'propertyId', '') = ${input.propertyId}`
      : undefined,
  ].filter((value) => value !== undefined);

  const notifications = await db.query.customerAppNotifications.findMany({
    where: filters.length === 1 ? filters[0] : and(...filters),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
    limit: input.limit ?? 20,
    offset: input.offset ?? 0,
  });

  return notifications.map(toPublicCustomerAppNotification);
}

export async function markLandlordNotificationRead(
  landlordId: string,
  notificationId: string,
) {
  const notification = await db.query.customerAppNotifications.findFirst({
    where: eq(customerAppNotifications.id, notificationId),
  });
  if (notification?.landlordId !== landlordId) {
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

