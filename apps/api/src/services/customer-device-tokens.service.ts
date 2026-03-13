import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { customerDeviceTokens } from "../db/schema";
import { normalizeKenyanPhoneNumber } from "../lib/staff-contact";

export async function listCustomerDeviceTokens(phoneNumber?: string) {
  return db.query.customerDeviceTokens.findMany({
    where: phoneNumber
      ? eq(
          customerDeviceTokens.phoneNumber,
          normalizeKenyanPhoneNumber(phoneNumber),
        )
      : undefined,
    orderBy: [desc(customerDeviceTokens.updatedAt)],
  });
}

export async function upsertCustomerDeviceToken(input: {
  phoneNumber: string;
  platform: "android" | "ios" | "web";
  token: string;
}) {
  const phoneNumber = normalizeKenyanPhoneNumber(input.phoneNumber);
  const existing = await db.query.customerDeviceTokens.findFirst({
    where: eq(customerDeviceTokens.token, input.token),
  });

  if (existing) {
    const [updated] = await db
      .update(customerDeviceTokens)
      .set({
        invalidatedAt: null,
        invalidationReason: null,
        phoneNumber,
        platform: input.platform,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(customerDeviceTokens.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(customerDeviceTokens)
    .values({
      phoneNumber,
      platform: input.platform,
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
