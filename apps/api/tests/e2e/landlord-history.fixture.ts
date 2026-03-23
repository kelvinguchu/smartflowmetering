import { eq } from "drizzle-orm";
import assert from "node:assert/strict";
import type { createApp } from "../../src/app";
import { db } from "../../src/db";
import {
  customers,
  meters,
  motherMeterEvents,
  motherMeters,
  properties,
  transactions,
  verification,
} from "../../src/db/schema";
import type { NewMeter, NewMotherMeter, NewProperty } from "../../src/db/schema";
import { uniqueRef } from "./helpers";

export async function loginAsLandlord(
  app: ReturnType<typeof createApp>,
  phoneNumber: string,
): Promise<string> {
  const sendResponse = await app.request("/api/mobile/landlord-access/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber }),
  });
  assert.equal(sendResponse.status, 200);

  const otpVerification = await db.query.verification.findFirst({
    where: eq(verification.identifier, phoneNumber),
  });
  assert.ok(otpVerification);
  const [code] = otpVerification.value.split(":");
  assert.ok(code);

  const verifyResponse = await app.request("/api/mobile/landlord-access/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, phoneNumber }),
  });
  assert.equal(verifyResponse.status, 200);
  const verifyBody = (await verifyResponse.json()) as {
    data: { token: string };
  };

  return verifyBody.data.token;
}

export async function loadLandlordByCustomerId(customerId: string) {
  return db.query.customers.findFirst({
    where: eq(customers.id, customerId),
  });
}

export async function seedLandlordHistoryFixture(fixture: {
  customerId: string;
  meterId: string;
  meterNumber: string;
  motherMeterId: string;
  tariffId: string;
}) {
  await db.insert(motherMeterEvents).values([
    {
      amount: "300.00",
      eventType: "initial_deposit",
      motherMeterId: fixture.motherMeterId,
      performedBy: crypto.randomUUID(),
    },
    {
      amount: "200.00",
      eventType: "refill",
      motherMeterId: fixture.motherMeterId,
      performedBy: crypto.randomUUID(),
    },
    {
      amount: "120.00",
      eventType: "bill_payment",
      motherMeterId: fixture.motherMeterId,
      performedBy: crypto.randomUUID(),
    },
  ]);

  await db.insert(transactions).values([
    {
      amountPaid: "144.44",
      commissionAmount: "14.44",
      completedAt: new Date("2026-03-12T07:00:00.000Z"),
      meterId: fixture.meterId,
      mpesaReceiptNumber: uniqueRef("MPESA"),
      netAmount: "130.00",
      paymentMethod: "paybill",
      phoneNumber: "254700111222",
      rateUsed: "24.0000",
      status: "completed",
      transactionId: uniqueRef("OHM"),
      unitsPurchased: "4.5000",
    },
    {
      amountPaid: "133.33",
      commissionAmount: "13.33",
      completedAt: new Date("2026-03-13T08:00:00.000Z"),
      meterId: fixture.meterId,
      mpesaReceiptNumber: uniqueRef("MPESA"),
      netAmount: "120.00",
      paymentMethod: "paybill",
      phoneNumber: "254711222333",
      rateUsed: "24.0000",
      status: "completed",
      transactionId: uniqueRef("OHM"),
      unitsPurchased: "5.0000",
    },
  ]);

  const [property] = await db
    .insert(properties)
    .values({
      landlordId: fixture.customerId,
      location: "Nairobi, Kenya",
      name: "Ignored Property",
      numberOfUnits: 1,
    } satisfies NewProperty)
    .returning({ id: properties.id });
  const [otherMotherMeter] = await db
    .insert(motherMeters)
    .values({
      landlordId: fixture.customerId,
      lowBalanceThreshold: "1000",
      motherMeterNumber: `MM-OTHER-${uniqueRef("MM")}`,
      propertyId: property.id,
      tariffId: fixture.tariffId,
      type: "postpaid",
    } satisfies NewMotherMeter)
    .returning({ id: motherMeters.id });
  const [otherMeter] = await db
    .insert(meters)
    .values({
      brand: "hexing",
      keyRevisionNumber: 1,
      meterNumber: `LANDLORD-HISTORY-OTHER-${uniqueRef("MTR")}`,
      meterType: "electricity",
      motherMeterId: otherMotherMeter.id,
      status: "active",
      supplyGroupCode: "600675",
      tariffId: fixture.tariffId,
      tariffIndex: 1,
    } satisfies NewMeter)
    .returning({ id: meters.id });

  await db.insert(transactions).values({
    amountPaid: "88.89",
    commissionAmount: "8.89",
    completedAt: new Date("2026-03-13T10:00:00.000Z"),
    meterId: otherMeter.id,
    mpesaReceiptNumber: uniqueRef("MPESA"),
    netAmount: "80.00",
    paymentMethod: "paybill",
    phoneNumber: "254799000111",
    rateUsed: "24.0000",
    status: "completed",
    transactionId: uniqueRef("OHM"),
    unitsPurchased: "3.3333",
  });
}
