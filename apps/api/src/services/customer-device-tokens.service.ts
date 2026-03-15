import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { customerDeviceTokens } from "../db/schema";
import { normalizeKenyanPhoneNumber } from "../lib/staff-contact";

export async function listCustomerDeviceTokens(input?: {
  landlordId?: string;
  phoneNumber?: string;
}) {
  const normalizedPhoneNumber =
    input?.phoneNumber === undefined
      ? undefined
      : normalizeKenyanPhoneNumber(input.phoneNumber);

  return db.query.customerDeviceTokens.findMany({
    where:
      input?.landlordId !== undefined
        ? eq(customerDeviceTokens.landlordId, input.landlordId)
        : normalizedPhoneNumber !== undefined
          ? eq(customerDeviceTokens.phoneNumber, normalizedPhoneNumber)
          : undefined,
    orderBy: [desc(customerDeviceTokens.updatedAt)],
  });
}

export async function upsertCustomerDeviceToken(input: {
  landlordId?: string;
  platform: "android" | "ios" | "web";
  phoneNumber?: string;
  token: string;
}) {
  const phoneNumber =
    input.phoneNumber === undefined
      ? null
      : normalizeKenyanPhoneNumber(input.phoneNumber);
  const landlordId = input.landlordId ?? null;
  const existing = await db.query.customerDeviceTokens.findFirst({
    where: eq(customerDeviceTokens.token, input.token),
  });

  if (existing) {
    const [updated] = await db
      .update(customerDeviceTokens)
      .set({
        invalidatedAt: null,
        invalidationReason: null,
        landlordId,
        phoneNumber,
        platform: input.platform,
        status: "active",
        tenantAccessId: null,
        updatedAt: new Date(),
      })
      .where(eq(customerDeviceTokens.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(customerDeviceTokens)
    .values({
      landlordId,
      phoneNumber,
      platform: input.platform,
      token: input.token,
    })
    .returning();

  return created;
}

export async function upsertTenantDeviceToken(input: {
  platform: "android" | "ios" | "web";
  tenantAccessId: string;
  token: string;
}) {
  const existing = await db.query.customerDeviceTokens.findFirst({
    where: eq(customerDeviceTokens.token, input.token),
  });

  if (existing) {
    const [updated] = await db
      .update(customerDeviceTokens)
      .set({
        invalidatedAt: null,
        invalidationReason: null,
        phoneNumber: null,
        platform: input.platform,
        status: "active",
        tenantAccessId: input.tenantAccessId,
        updatedAt: new Date(),
      })
      .where(eq(customerDeviceTokens.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(customerDeviceTokens)
    .values({
      phoneNumber: null,
      platform: input.platform,
      tenantAccessId: input.tenantAccessId,
      token: input.token,
    })
    .returning();

  return created;
}

export async function deactivateCustomerDeviceToken(id: string) {
  const existing = await db.query.customerDeviceTokens.findFirst({
    where: eq(customerDeviceTokens.id, id),
  });
  if (!existing) {
    return null;
  }

  const [updated] = await db
    .update(customerDeviceTokens)
    .set({
      invalidatedAt: new Date(),
      invalidationReason: "manual_deactivation",
      status: "inactive",
      updatedAt: new Date(),
    })
    .where(eq(customerDeviceTokens.id, id))
    .returning();

  return updated;
}

export async function invalidateCustomerDeviceTokens(
  tokens: string[],
  reason: string,
) {
  if (tokens.length === 0) {
    return;
  }

  await db
    .update(customerDeviceTokens)
    .set({
      invalidatedAt: new Date(),
      invalidationReason: reason,
      status: "inactive",
      updatedAt: new Date(),
    })
    .where(
      inArray(customerDeviceTokens.token, tokens),
    );
}
