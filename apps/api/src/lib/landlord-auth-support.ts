import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { customers, user } from "../db/schema";
import { normalizeKenyanPhoneNumber } from "./staff-contact";

export interface RegisteredLandlordCustomer {
  customerId: string;
  name: string;
  phoneNumber: string;
  userId: string;
}

export function buildLandlordTempEmail(phoneNumber: string): string {
  return `landlord-${normalizeKenyanPhoneNumber(phoneNumber)}@smartmetering.africa`;
}

export async function getRegisteredLandlordCustomerByPhoneNumber(
  phoneNumber: string,
): Promise<RegisteredLandlordCustomer | null> {
  const normalizedPhoneNumber = normalizeKenyanPhoneNumber(phoneNumber);
  const customer = await db.query.customers.findFirst({
    where: and(
      eq(customers.phoneNumber, normalizedPhoneNumber),
      eq(customers.customerType, "landlord"),
    ),
    columns: {
      id: true,
      name: true,
      phoneNumber: true,
      userId: true,
    },
  });
  if (!customer) {
    return null;
  }

  return {
    customerId: customer.id,
    name: customer.name,
    phoneNumber: customer.phoneNumber,
    userId: customer.userId,
  };
}

export async function isRegisteredLandlordPhoneNumber(
  phoneNumber: string,
): Promise<boolean> {
  try {
    const landlord = await getRegisteredLandlordCustomerByPhoneNumber(phoneNumber);
    if (landlord === null) {
      return false;
    }

    const existingUser = await db.query.user.findFirst({
      where: eq(user.phoneNumber, landlord.phoneNumber),
      columns: { id: true, role: true },
    });
    if (existingUser?.role && existingUser.role !== "landlord") {
      return existingUser.id === landlord.userId;
    }

    return true;
  } catch {
    return false;
  }
}

export async function syncLandlordAuthUser(
  phoneNumber: string,
  authUserId: string,
): Promise<void> {
  const landlord = await getRegisteredLandlordCustomerByPhoneNumber(phoneNumber);
  if (landlord === null) {
    return;
  }

  await db
    .update(user)
    .set({
      emailVerified: true,
      name: landlord.name,
      phoneNumber: landlord.phoneNumber,
      phoneNumberVerified: true,
      preferredTwoFactorMethod: "sms",
      role: "landlord",
      totpEnrollmentPromptPending: true,
      updatedAt: new Date(),
    })
    .where(eq(user.id, authUserId));

  if (landlord.userId !== authUserId) {
    await db
      .update(customers)
      .set({ userId: authUserId })
      .where(eq(customers.id, landlord.customerId));
  }
}
