import { eq } from "drizzle-orm";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
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
import {
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
  uniqueRef,
} from "./helpers";

const app = createApp();

void describe("E2E: landlord timeline", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("returns mixed purchase and mother meter events with running snapshots", async () => {
    const fixture = await ensureTestMeterFixture("LANDLORD-TIMELINE-METER-001");
    const landlord = await db.query.customers.findFirst({
      where: eq(customers.id, fixture.customerId),
    });
    assert.ok(landlord);

    const extra = await seedAdditionalTimelineFixture(fixture);
    await seedPrimaryTimelineFixture(fixture);
    const token = await loginAsLandlord(landlord.phoneNumber);

    const response = await app.request("/api/mobile/landlord-access/timeline?limit=10", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      count: number;
      data: {
        financialSnapshot: {
          companyPaymentsToUtility: string;
          postpaidOutstandingAmount: string | null;
          prepaidEstimatedBalance: string | null;
          utilityFundingLoaded: string;
        };
        motherMeter: { id: string; type: "postpaid" | "prepaid" };
        transaction: { mpesaReceiptNumber: string; unitsPurchased: string } | null;
        type: string;
      }[];
    };
    assert.equal(body.count, 7);
    assert.equal(body.data[0]?.type, "tenant_purchase");
    assert.equal(body.data[0]?.motherMeter.id, extra.motherMeterId);
    assert.equal(body.data[0]?.motherMeter.type, "postpaid");
    assert.equal(body.data[0]?.financialSnapshot.postpaidOutstandingAmount, "70.00");
    assert.equal(body.data[0]?.financialSnapshot.prepaidEstimatedBalance, null);

    const prepaidPurchase = body.data.find(
      (item) =>
        item.type === "tenant_purchase" &&
        item.motherMeter.id === fixture.motherMeterId &&
        item.transaction?.unitsPurchased === "5.0000",
    );
    assert.ok(prepaidPurchase);
    assert.equal(prepaidPurchase.financialSnapshot.utilityFundingLoaded, "500.00");
    assert.equal(prepaidPurchase.financialSnapshot.companyPaymentsToUtility, "120.00");
    assert.equal(prepaidPurchase.financialSnapshot.prepaidEstimatedBalance, "130.00");

    const propertyResponse = await app.request(
      `/api/mobile/landlord-access/timeline?propertyId=${fixture.propertyId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(propertyResponse.status, 200);
    const propertyBody = (await propertyResponse.json()) as {
      count: number;
      data: { motherMeter: { id: string } }[];
    };
    assert.equal(propertyBody.count, 5);
    assert.ok(
      propertyBody.data.every((item) => item.motherMeter.id === fixture.motherMeterId),
    );
  });
});

async function loginAsLandlord(phoneNumber: string): Promise<string> {
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

async function seedPrimaryTimelineFixture(fixture: {
  meterId: string;
  motherMeterId: string;
}) {
  await db.insert(motherMeterEvents).values([
    {
      amount: "300.00",
      createdAt: new Date("2026-03-11T06:00:00.000Z"),
      eventType: "initial_deposit",
      motherMeterId: fixture.motherMeterId,
      performedBy: crypto.randomUUID(),
    },
    {
      amount: "200.00",
      createdAt: new Date("2026-03-11T12:00:00.000Z"),
      eventType: "refill",
      motherMeterId: fixture.motherMeterId,
      performedBy: crypto.randomUUID(),
    },
    {
      amount: "120.00",
      createdAt: new Date("2026-03-12T09:00:00.000Z"),
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
}

async function seedAdditionalTimelineFixture(fixture: {
  customerId: string;
  tariffId: string;
}) {
  const [property] = await db
    .insert(properties)
    .values({
      landlordId: fixture.customerId,
      location: "Kiambu, Kenya",
      name: "Timeline Postpaid Property",
      numberOfUnits: 3,
    } satisfies NewProperty)
    .returning({ id: properties.id });
  const [motherMeter] = await db
    .insert(motherMeters)
    .values({
      landlordId: fixture.customerId,
      lowBalanceThreshold: "1000",
      motherMeterNumber: `MM-TIMELINE-${uniqueRef("MM")}`,
      propertyId: property.id,
      tariffId: fixture.tariffId,
      type: "postpaid",
    } satisfies NewMotherMeter)
    .returning({ id: motherMeters.id });
  const [meter] = await db
    .insert(meters)
    .values({
      brand: "hexing",
      keyRevisionNumber: 1,
      meterNumber: `LANDLORD-TIMELINE-POST-${uniqueRef("MTR")}`,
      meterType: "electricity",
      motherMeterId: motherMeter.id,
      status: "active",
      supplyGroupCode: "600675",
      tariffId: fixture.tariffId,
      tariffIndex: 1,
    } satisfies NewMeter)
    .returning({ id: meters.id });

  await db.insert(motherMeterEvents).values({
    amount: "20.00",
    createdAt: new Date("2026-03-13T07:00:00.000Z"),
    eventType: "bill_payment",
    motherMeterId: motherMeter.id,
    performedBy: crypto.randomUUID(),
  });
  await db.insert(transactions).values({
    amountPaid: "100.00",
    commissionAmount: "10.00",
    completedAt: new Date("2026-03-13T10:00:00.000Z"),
    meterId: meter.id,
    mpesaReceiptNumber: uniqueRef("MPESA"),
    netAmount: "90.00",
    paymentMethod: "paybill",
    phoneNumber: "254733444555",
    rateUsed: "24.0000",
    status: "completed",
    transactionId: uniqueRef("OHM"),
    unitsPurchased: "3.7500",
  });

  return { motherMeterId: motherMeter.id };
}
