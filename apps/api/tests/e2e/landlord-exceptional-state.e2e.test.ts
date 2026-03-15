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
  transactions,
  verification,
} from "../../src/db/schema";
import type { NewMeter, NewMotherMeter } from "../../src/db/schema";
import {
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
  uniqueRef,
} from "./helpers";

const app = createApp();

void describe("E2E: landlord exceptional state", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("returns landlord exceptional state summary and mother meter rows from existing aggregates", async () => {
    const fixture = await ensureTestMeterFixture("LANDLORD-EXCEPTION-001");
    const landlord = await db.query.customers.findFirst({
      where: eq(customers.id, fixture.customerId),
    });
    assert.ok(landlord);

    const [postpaidMotherMeter] = await db
      .insert(motherMeters)
      .values({
        landlordId: fixture.customerId,
        lowBalanceThreshold: "1000",
        motherMeterNumber: `MM-EXC-${uniqueRef("MM")}`,
        propertyId: fixture.propertyId,
        tariffId: fixture.tariffId,
        type: "postpaid",
      } satisfies NewMotherMeter)
      .returning({ id: motherMeters.id });

    const [postpaidMeter] = await db
      .insert(meters)
      .values({
        brand: "hexing",
        keyRevisionNumber: 1,
        meterNumber: `LANDLORD-EXC-POST-${uniqueRef("MTR")}`,
        meterType: "electricity",
        motherMeterId: postpaidMotherMeter.id,
        status: "active",
        supplyGroupCode: "600675",
        tariffId: fixture.tariffId,
        tariffIndex: 1,
      } satisfies NewMeter)
      .returning({ id: meters.id });

    await db.insert(motherMeterEvents).values([
      {
        amount: "100.00",
        createdAt: new Date("2026-03-10T06:00:00.000Z"),
        eventType: "initial_deposit",
        motherMeterId: fixture.motherMeterId,
        performedBy: crypto.randomUUID(),
      },
      {
        amount: "20.00",
        createdAt: new Date("2026-03-14T08:00:00.000Z"),
        eventType: "bill_payment",
        motherMeterId: fixture.motherMeterId,
        performedBy: crypto.randomUUID(),
      },
      {
        amount: "40.00",
        createdAt: new Date("2026-02-10T08:00:00.000Z"),
        eventType: "bill_payment",
        motherMeterId: postpaidMotherMeter.id,
        performedBy: crypto.randomUUID(),
      },
    ]);

    await db.insert(transactions).values([
      {
        amountPaid: "133.33",
        commissionAmount: "13.33",
        completedAt: new Date("2026-03-14T09:00:00.000Z"),
        meterId: fixture.meterId,
        mpesaReceiptNumber: uniqueRef("MPESA"),
        netAmount: "120.00",
        paymentMethod: "paybill",
        phoneNumber: "254700111222",
        rateUsed: "24.0000",
        status: "completed",
        transactionId: uniqueRef("OHM"),
        unitsPurchased: "5.0000",
      },
      {
        amountPaid: "166.67",
        commissionAmount: "16.67",
        completedAt: new Date("2026-03-14T10:00:00.000Z"),
        meterId: postpaidMeter.id,
        mpesaReceiptNumber: uniqueRef("MPESA"),
        netAmount: "150.00",
        paymentMethod: "paybill",
        phoneNumber: "254711222333",
        rateUsed: "24.0000",
        status: "completed",
        transactionId: uniqueRef("OHM"),
        unitsPurchased: "6.0000",
      },
    ]);

    const token = await loginAsLandlord(landlord.phoneNumber);

    const summaryResponse = await app.request(
      `/api/mobile/landlord-access/exceptional-state/summary?propertyId=${fixture.propertyId}&companyPaymentInactivityDays=20&postpaidOutstandingAmountThreshold=100`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(summaryResponse.status, 200);
    const summaryBody = (await summaryResponse.json()) as {
      data: {
        companyPayment: { staleCount: number };
        postpaid: { largeOutstandingCount: number };
        prepaid: { negativeBalanceCount: number };
        propertyId: string | null;
        totalExceptionalMotherMeters: number;
      };
      defaults: {
        companyPaymentInactivityDays: number;
        postpaidOutstandingAmountThreshold: string;
      };
    };
    assert.equal(summaryBody.data.propertyId, fixture.propertyId);
    assert.equal(summaryBody.data.prepaid.negativeBalanceCount, 1);
    assert.equal(summaryBody.data.postpaid.largeOutstandingCount, 1);
    assert.equal(summaryBody.data.companyPayment.staleCount, 1);
    assert.equal(summaryBody.data.totalExceptionalMotherMeters, 2);
    assert.equal(summaryBody.defaults.companyPaymentInactivityDays, 30);
    assert.equal(summaryBody.defaults.postpaidOutstandingAmountThreshold, "1000.00");

    const statesResponse = await app.request(
      `/api/mobile/landlord-access/exceptional-state/mother-meters?propertyId=${fixture.propertyId}&companyPaymentInactivityDays=20&postpaidOutstandingAmountThreshold=100&includeNominal=true`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(statesResponse.status, 200);
    const statesBody = (await statesResponse.json()) as {
      count: number;
      data: {
        companyPaymentStatus: {
          inactivityThresholdDays: number;
          isStale: boolean;
        };
        motherMeter: { id: string; type: "postpaid" | "prepaid" };
        postpaidStatus: {
          isLargeOutstanding: boolean;
          outstandingAmount: string;
          outstandingAmountThreshold: string;
        } | null;
        prepaidStatus: {
          estimatedBalance: string;
          isNegativeBalance: boolean;
        } | null;
      }[];
    };
    assert.equal(statesBody.count, 2);

    const prepaidState = statesBody.data.find(
      (item) => item.motherMeter.id === fixture.motherMeterId,
    );
    assert.ok(prepaidState);
    assert.equal(prepaidState.motherMeter.type, "prepaid");
    assert.equal(prepaidState.prepaidStatus?.estimatedBalance, "-40.00");
    assert.equal(prepaidState.prepaidStatus.isNegativeBalance, true);
    assert.equal(prepaidState.companyPaymentStatus.isStale, false);
    assert.equal(prepaidState.companyPaymentStatus.inactivityThresholdDays, 20);

    const postpaidState = statesBody.data.find(
      (item) => item.motherMeter.id === postpaidMotherMeter.id,
    );
    assert.ok(postpaidState);
    assert.equal(postpaidState.motherMeter.type, "postpaid");
    assert.equal(postpaidState.postpaidStatus?.outstandingAmount, "110.00");
    assert.equal(postpaidState.postpaidStatus.outstandingAmountThreshold, "100.00");
    assert.equal(postpaidState.postpaidStatus.isLargeOutstanding, true);
    assert.equal(postpaidState.companyPaymentStatus.isStale, true);

    const exceptionalOnlyResponse = await app.request(
      `/api/mobile/landlord-access/exceptional-state/mother-meters?propertyId=${fixture.propertyId}&companyPaymentInactivityDays=20&postpaidOutstandingAmountThreshold=100`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(exceptionalOnlyResponse.status, 200);
    const exceptionalOnlyBody = (await exceptionalOnlyResponse.json()) as {
      count: number;
      data: { motherMeter: { id: string } }[];
    };
    assert.equal(exceptionalOnlyBody.count, 2);
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
