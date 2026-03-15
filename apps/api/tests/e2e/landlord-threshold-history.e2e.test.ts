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

void describe("E2E: landlord threshold history", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("returns prepaid and postpaid threshold history per mother meter", async () => {
    const fixture = await ensureTestMeterFixture("LANDLORD-THRESH-HISTORY-001");
    const landlord = await db.query.customers.findFirst({
      where: eq(customers.id, fixture.customerId),
    });
    assert.ok(landlord);

    const [postpaidMotherMeter] = await db
      .insert(motherMeters)
      .values({
        landlordId: fixture.customerId,
        lowBalanceThreshold: "1000",
        motherMeterNumber: `MM-THRESH-HIST-${uniqueRef("MM")}`,
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
        meterNumber: `LANDLORD-THRESH-HIST-POST-${uniqueRef("MTR")}`,
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
        amount: "300.00",
        createdAt: new Date("2026-03-11T06:00:00.000Z"),
        eventType: "initial_deposit",
        motherMeterId: fixture.motherMeterId,
        performedBy: crypto.randomUUID(),
      },
      {
        amount: "40.00",
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
        eventType: "bill_payment",
        motherMeterId: postpaidMotherMeter.id,
        performedBy: crypto.randomUUID(),
      },
    ]);

    await db.insert(transactions).values([
      {
        amountPaid: "333.33",
        commissionAmount: "33.33",
        completedAt: new Date("2026-03-12T07:00:00.000Z"),
        meterId: fixture.meterId,
        mpesaReceiptNumber: uniqueRef("MPESA"),
        netAmount: "300.00",
        paymentMethod: "paybill",
        phoneNumber: "254700111222",
        rateUsed: "24.0000",
        status: "completed",
        transactionId: uniqueRef("OHM"),
        unitsPurchased: "10.0000",
      },
      {
        amountPaid: "100.00",
        commissionAmount: "10.00",
        completedAt: new Date("2026-03-12T08:00:00.000Z"),
        meterId: postpaidMeter.id,
        mpesaReceiptNumber: uniqueRef("MPESA"),
        netAmount: "90.00",
        paymentMethod: "paybill",
        phoneNumber: "254711222333",
        rateUsed: "24.0000",
        status: "completed",
        transactionId: uniqueRef("OHM"),
        unitsPurchased: "3.0000",
      },
    ]);

    const token = await loginAsLandlord(landlord.phoneNumber);

    const prepaidResponse = await app.request(
      `/api/mobile/landlord-access/thresholds/mother-meters/${fixture.motherMeterId}/history?startDate=2026-03-11&endDate=2026-03-13`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(prepaidResponse.status, 200);
    const prepaidBody = (await prepaidResponse.json()) as {
      count: number;
      data: {
        date: string;
        prepaidStatus: { estimatedBalance: string; isBelowThreshold: boolean } | null;
      }[];
    };
    assert.equal(prepaidBody.count, 3);
    assert.equal(prepaidBody.data[0]?.date, "2026-03-11");
    assert.equal(prepaidBody.data[0]?.prepaidStatus?.estimatedBalance, "300.00");
    assert.equal(prepaidBody.data[1]?.prepaidStatus?.isBelowThreshold, true);
    assert.equal(prepaidBody.data[2]?.prepaidStatus?.estimatedBalance, "0.00");

    const postpaidResponse = await app.request(
      `/api/mobile/landlord-access/thresholds/mother-meters/${postpaidMotherMeter.id}/history?startDate=2026-03-10&endDate=2026-03-12&daysAfterLastPayment=7`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(postpaidResponse.status, 200);
    const postpaidBody = (await postpaidResponse.json()) as {
      count: number;
      data: {
        date: string;
        postpaidStatus: { isReminderDue: boolean; outstandingAmount: string } | null;
      }[];
    };
    assert.equal(postpaidBody.count, 3);
    assert.equal(postpaidBody.data[0]?.date, "2026-03-10");
    assert.equal(postpaidBody.data[0]?.postpaidStatus?.isReminderDue, true);
    assert.equal(postpaidBody.data[1]?.postpaidStatus?.outstandingAmount, "0.00");
    assert.equal(postpaidBody.data[2]?.postpaidStatus?.outstandingAmount, "50.00");
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
