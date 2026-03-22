import type { CustomerAppNotification } from "../../db/schema/customer-app-notifications";
import type { CustomerDeviceToken } from "../../db/schema/customer-device-tokens";
import type { LandlordAccessSummary } from "../landlord/landlord-access.types";
import type { TenantAccessSummary, TenantMeterSummary } from "../tenant/tenant-access.types";

const INTERNAL_METADATA_KEYS = new Set([
  "customerId",
  "landlordId",
  "meterId",
  "motherMeterId",
  "propertyId",
  "tenantAccessId",
  "userId",
]);

export function toPublicLandlordAccess(access: LandlordAccessSummary) {
  return {
    motherMeters: access.motherMeters.map((item) => ({
      id: item.id,
      motherMeterNumber: item.motherMeterNumber,
      propertyId: item.propertyId,
      type: item.type,
    })),
    name: access.name,
    phoneNumber: access.phoneNumber,
    properties: access.properties.map((item) => ({
      id: item.id,
      location: item.location,
      name: item.name,
    })),
  };
}

export function toPublicLandlordUser(user: { role?: string | null }) {
  return {
    role: user.role ?? "landlord",
  };
}

export function toPublicTenantAccess(access: TenantAccessSummary | TenantMeterSummary) {
  return {
    meter: {
      meterNumber: access.meterNumber,
      meterType: access.meterType,
      motherMeterNumber: access.motherMeterNumber,
      propertyName: access.propertyName,
    },
  };
}

export function toPublicCustomerDeviceToken(token: CustomerDeviceToken) {
  return {
    createdAt: token.createdAt.toISOString(),
    invalidatedAt: token.invalidatedAt?.toISOString() ?? null,
    platform: token.platform,
    status: token.status,
    updatedAt: token.updatedAt.toISOString(),
  };
}

export function toPublicCustomerAppNotification(
  notification: CustomerAppNotification,
) {
  const metadata = sanitizeNotificationMetadata(notification.metadata);

  return {
    createdAt: notification.createdAt.toISOString(),
    id: notification.id,
    lastAttemptAt: notification.lastAttemptAt?.toISOString() ?? null,
    message: notification.message,
    metadata,
    meterNumber: notification.meterNumber,
    readAt: notification.readAt?.toISOString() ?? null,
    referenceId: notification.referenceId,
    sentAt: notification.sentAt?.toISOString() ?? null,
    status: notification.status,
    title: notification.title,
    type: notification.type,
  };
}

function sanitizeNotificationMetadata(value: unknown): Record<string, unknown> | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const sanitized = sanitizeObject(value);
  return Object.keys(sanitized).length === 0 ? null : sanitized;
}

function sanitizeObject(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.entries(value).reduce<Record<string, unknown>>(
    (result, [key, current]) => {
      if (INTERNAL_METADATA_KEYS.has(key)) {
        return result;
      }

      const sanitized = sanitizeValue(current);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
      return result;
    },
    {},
  );
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const sanitizedItems = value
      .map((item) => sanitizeValue(item))
      .filter((item) => item !== undefined);
    return sanitizedItems.length === 0 ? undefined : sanitizedItems;
  }

  if (isPlainObject(value)) {
    const sanitizedObject = sanitizeObject(value);
    return Object.keys(sanitizedObject).length === 0 ? undefined : sanitizedObject;
  }

  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}



