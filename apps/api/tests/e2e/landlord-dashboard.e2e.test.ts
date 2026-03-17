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

void describe("E2E: landlord dashboard", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("returns landlord summary, mother meter details, and purchase history without company commission", async () => {
    const fixture = await ensureTestMeterFixture("LANDLORD-DASH-METER-001");
    const landlord = await db.query.customers.findFirst({
      where: eq(customers.id, fixture.customerId),
    });
    assert.ok(landlord);

    await seedPrepaidMotherMeterData(fixture);
    const postpaidMeter = await seedPostpaidMotherMeterData(fixture);
    const token = await loginAsLandlord(landlord.phoneNumber);

    const summaryResponse = await app.request(
      "/api/mobile/landlord-access/summary",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(summaryResponse.status, 200);
    const summaryBody = (await summaryResponse.json()) as {
      data: {
        financials: {
          companyPaymentsToUtility: string;
          netSalesCollected: string;
          postpaidOutstandingAmount: string;
          prepaidEstimatedBalance: string;
          utilityFundingLoaded: string;
        };
        overview: {
          activeSubMeterCount: number;
          motherMeterCount: number;
          subMeterCount: number;
        };
      };
    };
    assert.equal(summaryBody.data.overview.motherMeterCount, 2);
    assert.equal(summaryBody.data.overview.subMeterCount, 2);
    assert.equal(summaryBody.data.overview.activeSubMeterCount, 2);
    assert.equal(summaryBody.data.financials.prepaidEstimatedBalance, "220.00");
    assert.equal(summaryBody.data.financials.postpaidOutstandingAmount, "70.00");
    assert.equal(summaryBody.data.financials.companyPaymentsToUtility, "150.00");
    assert.equal(summaryBody.data.financials.utilityFundingLoaded, "500.00");
    assert.equal(summaryBody.data.financials.netSalesCollected, "300.00");

    const filteredSummaryResponse = await app.request(
      `/api/mobile/landlord-access/summary?propertyId=${fixture.propertyId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(filteredSummaryResponse.status, 200);
    const filteredSummaryBody = (await filteredSummaryResponse.json()) as {
      data: {
        financials: {
          postpaidOutstandingAmount: string;
          prepaidEstimatedBalance: string;
        };
        overview: {
          motherMeterCount: number;
          subMeterCount: number;
        };
      };
    };
    assert.equal(filteredSummaryBody.data.overview.motherMeterCount, 1);
    assert.equal(filteredSummaryBody.data.overview.subMeterCount, 1);
    assert.equal(filteredSummaryBody.data.financials.prepaidEstimatedBalance, "220.00");
    assert.equal(filteredSummaryBody.data.financials.postpaidOutstandingAmount, "0.00");

    const motherMetersResponse = await app.request(
      "/api/mobile/landlord-access/mother-meters",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(motherMetersResponse.status, 200);
    const motherMetersBody = (await motherMetersResponse.json()) as {
      count: number;
      data: {
        financials: {
          postpaidOutstandingAmount: string | null;
          prepaidEstimatedBalance: string | null;
        };
        motherMeterNumber: string;
        property: { id?: string; name: string };
        subMeters: { id?: string; meterNumber: string; totalNetSales: string }[];
        type: "postpaid" | "prepaid";
      }[];
    };
    assert.equal(motherMetersBody.count, 2);

    const prepaidItem = motherMetersBody.data.find((item) => item.type === "prepaid");
    assert.ok(prepaidItem);
    assert.equal(prepaidItem.financials.prepaidEstimatedBalance, "220.00");
    assert.equal("id" in prepaidItem.property, false);
    assert.equal(prepaidItem.subMeters[0]?.meterNumber, fixture.meterNumber);
    assert.equal(prepaidItem.subMeters[0]?.totalNetSales, "180.00");
    assert.equal("id" in (prepaidItem.subMeters[0] ?? {}), false);

    const postpaidItem = motherMetersBody.data.find((item) => item.type === "postpaid");
    assert.ok(postpaidItem);
    assert.equal(postpaidItem.motherMeterNumber, postpaidMeter.motherMeterNumber);
    assert.equal(postpaidItem.financials.postpaidOutstandingAmount, "70.00");
    assert.equal("id" in postpaidItem.property, false);

    const filteredMotherMetersResponse = await app.request(
      `/api/mobile/landlord-access/mother-meters?propertyId=${fixture.propertyId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(filteredMotherMetersResponse.status, 200);
    const filteredMotherMetersBody = (await filteredMotherMetersResponse.json()) as {
      count: number;
      data: { motherMeterNumber: string; type: "postpaid" | "prepaid" }[];
    };
    assert.equal(filteredMotherMetersBody.count, 1);
    assert.equal(filteredMotherMetersBody.data[0]?.type, "prepaid");
    assert.notEqual(
      filteredMotherMetersBody.data[0]?.motherMeterNumber,
      postpaidMeter.motherMeterNumber,
    );

    const purchasesResponse = await app.request(
      `/api/mobile/landlord-access/purchases?meterNumber=${postpaidMeter.meterNumber}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(purchasesResponse.status, 200);
    const purchasesBody = (await purchasesResponse.json()) as {
      count: number;
      data: {
        amountPaid?: string;
        commissionAmount?: string;
        createdAt?: string;
        meter: { id?: string; meterNumber: string };
        meterCreditAmount: string;
        motherMeter: { id?: string; motherMeterNumber: string };
        rateUsed?: string;
        transactionId: string;
      }[];
    };
    assert.equal(purchasesBody.count, 1);
    assert.equal(purchasesBody.data[0]?.meter.meterNumber, postpaidMeter.meterNumber);
    assert.equal(
      purchasesBody.data[0]?.motherMeter.motherMeterNumber,
      postpaidMeter.motherMeterNumber,
    );
    assert.equal(purchasesBody.data[0]?.meterCreditAmount, "120.00");
    assert.equal("id" in (purchasesBody.data[0]?.meter ?? {}), false);
    assert.equal("id" in (purchasesBody.data[0]?.motherMeter ?? {}), false);
    assert.ok(!("amountPaid" in (purchasesBody.data[0] ?? {})));
    assert.ok(!("commissionAmount" in (purchasesBody.data[0] ?? {})));
    assert.ok(!("createdAt" in (purchasesBody.data[0] ?? {})));
    assert.ok(!("rateUsed" in (purchasesBody.data[0] ?? {})));

    const filteredPurchasesResponse = await app.request(
      `/api/mobile/landlord-access/purchases?propertyId=${fixture.propertyId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(filteredPurchasesResponse.status, 200);
    const filteredPurchasesBody = (await filteredPurchasesResponse.json()) as {
      count: number;
      data: { meter: { meterNumber: string } }[];
    };
    assert.equal(filteredPurchasesBody.count, 1);
    assert.equal(filteredPurchasesBody.data[0]?.meter.meterNumber, fixture.meterNumber);
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

async function seedPostpaidMotherMeterData(fixture: {
  customerId: string;
  tariffId: string;
}) {
  const [property] = await db
    .insert(properties)
    .values({
      landlordId: fixture.customerId,
      location: "Nairobi, Kenya",
      name: "Postpaid Property",
      numberOfUnits: 1,
    } satisfies NewProperty)
    .returning({ id: properties.id });

  const motherMeterNumber = `MM-POSTPAID-${uniqueRef("MM")}`;
  const [motherMeter] = await db
    .insert(motherMeters)
    .values({
      landlordId: fixture.customerId,
      lowBalanceThreshold: "1000",
      motherMeterNumber,
      propertyId: property.id,
      tariffId: fixture.tariffId,
      type: "postpaid",
    } satisfies NewMotherMeter)
    .returning({ id: motherMeters.id, motherMeterNumber: motherMeters.motherMeterNumber });

  const meterNumber = `LANDLORD-POST-${uniqueRef("MTR")}`;
  const [meter] = await db
    .insert(meters)
    .values({
      brand: "hexing",
      keyRevisionNumber: 1,
      meterNumber,
      meterType: "electricity",
      motherMeterId: motherMeter.id,
      status: "active",
      supplyGroupCode: "600675",
      tariffId: fixture.tariffId,
      tariffIndex: 1,
    } satisfies NewMeter)
    .returning({ id: meters.id, meterNumber: meters.meterNumber });

  await db.insert(motherMeterEvents).values({
    amount: "50.00",
    eventType: "bill_payment",
    motherMeterId: motherMeter.id,
    performedBy: crypto.randomUUID(),
  });

  await db.insert(transactions).values({
    amountPaid: "133.33",
    commissionAmount: "13.33",
    completedAt: new Date("2026-03-14T10:00:00.000Z"),
    meterId: meter.id,
    mpesaReceiptNumber: uniqueRef("MPESA"),
    netAmount: "120.00",
    paymentMethod: "paybill",
    phoneNumber: "254712345678",
    rateUsed: "24.0000",
    status: "completed",
    transactionId: uniqueRef("OHM"),
    unitsPurchased: "5.0000",
  });

  return {
    meterNumber: meter.meterNumber,
    propertyId: property.id,
    motherMeterNumber: motherMeter.motherMeterNumber,
  };
}

async function seedPrepaidMotherMeterData(fixture: {
  meterId: string;
  motherMeterId: string;
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
      amount: "100.00",
      eventType: "bill_payment",
      motherMeterId: fixture.motherMeterId,
      performedBy: crypto.randomUUID(),
    },
  ]);

  await db.insert(transactions).values({
    amountPaid: "200.00",
    commissionAmount: "20.00",
    completedAt: new Date("2026-03-14T09:00:00.000Z"),
    meterId: fixture.meterId,
    mpesaReceiptNumber: uniqueRef("MPESA"),
    netAmount: "180.00",
    paymentMethod: "paybill",
    phoneNumber: "254700111222",
    rateUsed: "24.0000",
    status: "completed",
    transactionId: uniqueRef("OHM"),
    unitsPurchased: "7.5000",
  });
}
