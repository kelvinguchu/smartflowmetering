import { eq } from "drizzle-orm";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import {
  customerAppNotifications,
  generatedTokens,
  meters,
  transactions,
} from "../../src/db/schema";
import { protectToken } from "../../src/lib/token-protection";
import {
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
  uniqueRef,
} from "./helpers";

const app = createApp();

void describe("E2E: tenant exceptional state", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("returns current exceptional tenant states without leaking non-exceptional items", async () => {
    const fixture = await ensureTestMeterFixture("TENANT-STATE-001");
    const bootstrapResponse = await app.request(
      "/api/mobile/tenant-access/bootstrap",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meterNumber: fixture.meterNumber }),
      },
    );
    const bootstrapBody = (await bootstrapResponse.json()) as {
      data: { accessToken: string; tenantAccess: { id: string } };
    };

    const statusChangedAt = new Date(Date.now() - 4 * 60 * 60 * 1000);
    await db
      .update(meters)
      .set({ status: "suspended", updatedAt: statusChangedAt })
      .where(eq(meters.id, fixture.meterId));

    const pendingCompletedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const availableCompletedAt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const readCompletedAt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const recentCompletedAt = new Date(Date.now() - 5 * 60 * 1000);

    const insertedTransactions = await db
      .insert(transactions)
      .values([
        {
          amountPaid: "111.11",
          commissionAmount: "11.11",
          completedAt: pendingCompletedAt,
          meterId: fixture.meterId,
          mpesaReceiptNumber: uniqueRef("MPESA"),
          netAmount: "100.00",
          paymentMethod: "paybill",
          phoneNumber: "254700001111",
          rateUsed: "25.0000",
          status: "completed",
          transactionId: uniqueRef("OHM"),
          unitsPurchased: "4.0000",
        },
        {
          amountPaid: "166.67",
          commissionAmount: "16.67",
          completedAt: availableCompletedAt,
          meterId: fixture.meterId,
          mpesaReceiptNumber: uniqueRef("MPESA"),
          netAmount: "150.00",
          paymentMethod: "stk_push",
          phoneNumber: "254700002222",
          rateUsed: "25.0000",
          status: "completed",
          transactionId: uniqueRef("OHM"),
          unitsPurchased: "6.0000",
        },
        {
          amountPaid: "133.33",
          commissionAmount: "13.33",
          completedAt: readCompletedAt,
          meterId: fixture.meterId,
          mpesaReceiptNumber: uniqueRef("MPESA"),
          netAmount: "120.00",
          paymentMethod: "paybill",
          phoneNumber: "254700003333",
          rateUsed: "24.0000",
          status: "completed",
          transactionId: uniqueRef("OHM"),
          unitsPurchased: "5.0000",
        },
        {
          amountPaid: "88.89",
          commissionAmount: "8.89",
          completedAt: recentCompletedAt,
          meterId: fixture.meterId,
          mpesaReceiptNumber: uniqueRef("MPESA"),
          netAmount: "80.00",
          paymentMethod: "paybill",
          phoneNumber: "254700004444",
          rateUsed: "20.0000",
          status: "completed",
          transactionId: uniqueRef("OHM"),
          unitsPurchased: "4.0000",
        },
      ])
      .returning({ id: transactions.id, transactionId: transactions.transactionId });

    const pendingTransaction = insertedTransactions[0];
    const availableTransaction = insertedTransactions[1];
    const readTransaction = insertedTransactions[2];

    await db.insert(generatedTokens).values([
      {
        createdAt: new Date(Date.now() - 170 * 60 * 1000),
        generatedBy: "system",
        meterId: fixture.meterId,
        token: protectToken("12345678901234567890"),
        tokenType: "credit",
        transactionId: availableTransaction.id,
        value: "6.0000",
      },
      {
        createdAt: new Date(Date.now() - 160 * 60 * 1000),
        generatedBy: "system",
        meterId: fixture.meterId,
        token: protectToken("99999999999999991234"),
        tokenType: "credit",
        transactionId: readTransaction.id,
        value: "5.0000",
      },
    ]);

    await db.insert(customerAppNotifications).values([
      {
        message: "Your token is ready",
        meterNumber: fixture.meterNumber,
        referenceId: availableTransaction.transactionId,
        status: "sent",
        tenantAccessId: bootstrapBody.data.tenantAccess.id,
        title: "Token ready",
        type: "token_delivery_available",
      },
      {
        message: "Your token was already seen",
        meterNumber: fixture.meterNumber,
        readAt: new Date(Date.now() - 120 * 60 * 1000),
        referenceId: readTransaction.transactionId,
        status: "read",
        tenantAccessId: bootstrapBody.data.tenantAccess.id,
        title: "Token already seen",
        type: "token_delivery_available",
      },
    ]);

    const response = await app.request(
      "/api/mobile/tenant-access/exceptional-state",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${bootstrapBody.data.accessToken}`,
        },
      },
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      data: {
        appNotificationStatus?: string;
        minutesSinceCompletion?: number;
        minutesSinceStatusChange?: number;
        minutesSinceTokenGenerated?: number;
        status?: string;
        transactionId?: string;
        type: string;
      }[];
      meter: { meterNumber: string; status: string };
      summary: { count: number; criticalCount: number; warningCount: number };
      thresholds: { pendingTokenMinutes: number; unacknowledgedTokenMinutes: number };
    };

    assert.equal(body.meter.meterNumber, fixture.meterNumber);
    assert.equal(body.meter.status, "suspended");
    assert.equal(body.summary.count, 3);
    assert.equal(body.summary.criticalCount, 1);
    assert.equal(body.summary.warningCount, 2);
    assert.equal(body.thresholds.pendingTokenMinutes, 15);
    assert.equal(body.thresholds.unacknowledgedTokenMinutes, 60);

    const itemTypes = body.data.map((item) => item.type);
    assert.deepEqual(itemTypes.sort(), [
      "meter_suspended",
      "token_available_unacknowledged",
      "token_pending_generation",
    ]);

    const suspendedItem = body.data.find((item) => item.type === "meter_suspended");
    if (!suspendedItem) {
      assert.fail("Expected suspended meter exceptional state");
    }
    assert.equal(suspendedItem.status, "suspended");
    if (typeof suspendedItem.minutesSinceStatusChange !== "number") {
      assert.fail("Expected numeric minutesSinceStatusChange");
    }
    assert.ok(suspendedItem.minutesSinceStatusChange >= 239);

    const pendingItem = body.data.find(
      (item) => item.type === "token_pending_generation",
    );
    if (!pendingItem) {
      assert.fail("Expected pending token exceptional state");
    }
    assert.equal(pendingItem.transactionId, pendingTransaction.transactionId);
    if (typeof pendingItem.minutesSinceCompletion !== "number") {
      assert.fail("Expected numeric minutesSinceCompletion");
    }
    assert.ok(pendingItem.minutesSinceCompletion >= body.thresholds.pendingTokenMinutes);

    const unacknowledgedItem = body.data.find(
      (item) => item.type === "token_available_unacknowledged",
    );
    if (!unacknowledgedItem) {
      assert.fail("Expected unacknowledged token exceptional state");
    }
    assert.equal(unacknowledgedItem.transactionId, availableTransaction.transactionId);
    assert.equal(unacknowledgedItem.appNotificationStatus, "sent");
    if (typeof unacknowledgedItem.minutesSinceTokenGenerated !== "number") {
      assert.fail("Expected numeric minutesSinceTokenGenerated");
    }
    assert.ok(
      unacknowledgedItem.minutesSinceTokenGenerated >=
        body.thresholds.unacknowledgedTokenMinutes,
    );

    assert.equal(
      body.data.some((item) => item.transactionId === readTransaction.transactionId),
      false,
    );
  });
});
