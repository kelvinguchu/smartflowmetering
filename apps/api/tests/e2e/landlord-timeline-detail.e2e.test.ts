import { eq } from "drizzle-orm";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import {
  customers,
  motherMeterEvents,
  transactions,
  verification,
} from "../../src/db/schema";
import {
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
  uniqueRef,
} from "./helpers";

const app = createApp();
const hasOwnProperty = Object.prototype.hasOwnProperty;

void describe("E2E: landlord timeline detail", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("returns mother meter and sub meter timeline drill-down for the landlord", async () => {
    const fixture = await ensureTestMeterFixture(
      "LANDLORD-TIMELINE-DETAIL-001",
    );
    const landlord = await db.query.customers.findFirst({
      where: eq(customers.id, fixture.customerId),
    });
    assert.ok(landlord);

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

    const token = await loginAsLandlord(landlord.phoneNumber);

    const motherMeterResponse = await app.request(
      `/api/mobile/landlord-access/mother-meters/${fixture.motherMeterId}/timeline`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(motherMeterResponse.status, 200);
    const motherMeterBody = (await motherMeterResponse.json()) as {
      count: number;
      data: {
        motherMeter: { motherMeterNumber: string; property: { name: string } };
        transaction: { unitsPurchased: string } | null;
        type: string;
      }[];
    };
    assert.equal(motherMeterBody.count, 5);
    const firstMotherMeterItem = motherMeterBody.data[0] as Record<
      string,
      unknown
    > & {
      motherMeter: Record<string, unknown> & {
        property: Record<string, unknown>;
      };
    };
    assert.equal(
      hasOwnProperty.call(firstMotherMeterItem, "referenceId"),
      false,
    );
    assert.equal(
      hasOwnProperty.call(firstMotherMeterItem.motherMeter, "id"),
      false,
    );
    assert.equal(
      hasOwnProperty.call(firstMotherMeterItem.motherMeter.property, "id"),
      false,
    );
    const purchaseItem = motherMeterBody.data.find(
      (item) => item.type === "tenant_purchase",
    );
    assert.ok(purchaseItem);
    assert.equal(
      hasOwnProperty.call(
        (purchaseItem.transaction ?? {}) as Record<string, unknown>,
        "mpesaReceiptNumber",
      ),
      false,
    );
    assert.equal(
      hasOwnProperty.call(
        (purchaseItem.transaction ?? {}) as Record<string, unknown>,
        "phoneNumber",
      ),
      false,
    );
    assert.ok(
      motherMeterBody.data.every(
        (item) =>
          item.motherMeter.motherMeterNumber === fixture.motherMeterNumber,
      ),
    );
    assert.ok(
      motherMeterBody.data.some((item) => item.type === "bill_payment"),
    );
    assert.ok(
      motherMeterBody.data.some((item) => item.type === "tenant_purchase"),
    );

    const subMeterResponse = await app.request(
      `/api/mobile/landlord-access/sub-meters/${fixture.meterId}/timeline`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(subMeterResponse.status, 200);
    const subMeterBody = (await subMeterResponse.json()) as {
      count: number;
      data: {
        cumulativeNetSales: string;
        cumulativeUnitsPurchased: string;
        meterCreditAmount: string;
        occurredAt: string;
        unitsPurchased: string;
      }[];
    };
    assert.equal(subMeterBody.count, 2);
    assert.equal(subMeterBody.data[0]?.meterCreditAmount, "120.00");
    assert.equal(subMeterBody.data[0]?.cumulativeNetSales, "250.00");
    assert.equal(subMeterBody.data[0]?.cumulativeUnitsPurchased, "9.5000");
    assert.equal(subMeterBody.data[1]?.cumulativeNetSales, "130.00");
    const [firstSubMeterItem] = subMeterBody.data;
    assert.ok(firstSubMeterItem);
    assert.equal(
      hasOwnProperty.call(firstSubMeterItem, "mpesaReceiptNumber"),
      false,
    );
    assert.equal(hasOwnProperty.call(firstSubMeterItem, "phoneNumber"), false);
    assert.equal(
      hasOwnProperty.call(firstSubMeterItem, "transactionId"),
      false,
    );
  });
});

async function loginAsLandlord(phoneNumber: string): Promise<string> {
  const sendResponse = await app.request(
    "/api/mobile/landlord-access/send-otp",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    },
  );
  assert.equal(sendResponse.status, 200);

  const otpVerification = await db.query.verification.findFirst({
    where: eq(verification.identifier, phoneNumber),
  });
  assert.ok(otpVerification);
  const [code] = otpVerification.value.split(":");
  assert.ok(code);

  const verifyResponse = await app.request(
    "/api/mobile/landlord-access/verify-otp",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, phoneNumber }),
    },
  );
  assert.equal(verifyResponse.status, 200);
  const verifyBody = (await verifyResponse.json()) as {
    data: { token: string };
  };

  return verifyBody.data.token;
}
