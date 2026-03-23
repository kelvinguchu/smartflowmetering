import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import { customerAppNotifications, generatedTokens, transactions } from "../../src/db/schema";
import { protectToken } from "../../src/lib/token-protection";
import {
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
  uniqueRef,
} from "./helpers";
import { getLatestTenantAccessIdForMeter } from "./tenant-access-test-helpers";

const app = createApp();

void describe("E2E: tenant history", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("returns tenant history summary and unified recovery states", async () => {
    const fixture = await ensureTestMeterFixture("TENANT-HISTORY-001");
    const [pendingTx, processingTx, failedTx, completedTx, acknowledgedTx] = await db
      .insert(transactions)
      .values([
        {
          amountPaid: "100.00",
          commissionAmount: "10.00",
          meterId: fixture.meterId,
          mpesaReceiptNumber: uniqueRef("MPESA"),
          netAmount: "90.00",
          paymentMethod: "paybill",
          phoneNumber: "254700111222",
          rateUsed: "20.0000",
          status: "pending",
          transactionId: uniqueRef("OHM"),
          unitsPurchased: "4.5000",
        },
        {
          amountPaid: "111.11",
          commissionAmount: "11.11",
          meterId: fixture.meterId,
          mpesaReceiptNumber: uniqueRef("MPESA"),
          netAmount: "100.00",
          paymentMethod: "stk_push",
          phoneNumber: "254700222333",
          rateUsed: "20.0000",
          status: "processing",
          transactionId: uniqueRef("OHM"),
          unitsPurchased: "5.0000",
        },
        {
          amountPaid: "122.22",
          commissionAmount: "12.22",
          meterId: fixture.meterId,
          mpesaReceiptNumber: uniqueRef("MPESA"),
          netAmount: "110.00",
          paymentMethod: "paybill",
          phoneNumber: "254700333444",
          rateUsed: "20.0000",
          status: "failed",
          transactionId: uniqueRef("OHM"),
          unitsPurchased: "5.5000",
        },
        {
          amountPaid: "133.33",
          commissionAmount: "13.33",
          completedAt: new Date("2026-03-15T08:00:00.000Z"),
          meterId: fixture.meterId,
          mpesaReceiptNumber: uniqueRef("MPESA"),
          netAmount: "120.00",
          paymentMethod: "paybill",
          phoneNumber: "254700444555",
          rateUsed: "24.0000",
          status: "completed",
          transactionId: uniqueRef("OHM"),
          unitsPurchased: "5.0000",
        },
        {
          amountPaid: "166.67",
          commissionAmount: "16.67",
          completedAt: new Date("2026-03-16T09:00:00.000Z"),
          meterId: fixture.meterId,
          mpesaReceiptNumber: uniqueRef("MPESA"),
          netAmount: "150.00",
          paymentMethod: "stk_push",
          phoneNumber: "254700555666",
          rateUsed: "25.0000",
          status: "completed",
          transactionId: uniqueRef("OHM"),
          unitsPurchased: "6.0000",
        },
      ])
      .returning({ id: transactions.id, transactionId: transactions.transactionId });

    await db.insert(generatedTokens).values([
      {
        generatedBy: "system",
        meterId: fixture.meterId,
        token: protectToken("12345678901234567890"),
        tokenType: "credit",
        transactionId: completedTx.id,
        value: "5.0000",
      },
      {
        generatedBy: "system",
        meterId: fixture.meterId,
        token: protectToken("99999999999999991234"),
        tokenType: "credit",
        transactionId: acknowledgedTx.id,
        value: "6.0000",
      },
    ]);

    const bootstrapResponse = await app.request(
      "/api/mobile/tenant-access/bootstrap",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meterNumber: fixture.meterNumber }),
      },
    );
    const bootstrapBody = (await bootstrapResponse.json()) as {
      data: {
        accessToken: string;
      };
    };
    const tenantAccessId = await getLatestTenantAccessIdForMeter(fixture.meterId);

    await db.insert(customerAppNotifications).values([
      {
        message: "Your token is available",
        meterNumber: fixture.meterNumber,
        referenceId: completedTx.transactionId,
        status: "sent",
        tenantAccessId,
        title: "Token available",
        type: "token_delivery_available",
      },
      {
        message: "Your token was acknowledged",
        meterNumber: fixture.meterNumber,
        readAt: new Date("2026-03-16T10:00:00.000Z"),
        referenceId: acknowledgedTx.transactionId,
        status: "read",
        tenantAccessId,
        title: "Token acknowledged",
        type: "token_delivery_available",
      },
    ]);

    const headers = {
      Authorization: `Bearer ${bootstrapBody.data.accessToken}`,
    };

    const summaryResponse = await app.request(
      "/api/mobile/tenant-access/history-summary",
      {
        method: "GET",
        headers,
      },
    );
    assert.equal(summaryResponse.status, 200);
    const summaryBody = (await summaryResponse.json()) as {
      data: {
        paymentMethodBreakdown: {
          paybillCompletedCount: number;
          stkPushCompletedCount: number;
        };
        statusBreakdown: {
          completed: number;
          failed: number;
          pending: number;
          processing: number;
        };
        summary: {
          totalCompletedPurchases: number;
          totalMeterCreditAmount: string;
          totalUnitsPurchased: string;
        };
      };
    };
    assert.equal(summaryBody.data.statusBreakdown.pending, 1);
    assert.equal(summaryBody.data.statusBreakdown.processing, 1);
    assert.equal(summaryBody.data.statusBreakdown.failed, 1);
    assert.equal(summaryBody.data.statusBreakdown.completed, 2);
    assert.equal(summaryBody.data.summary.totalCompletedPurchases, 2);
    assert.equal(summaryBody.data.summary.totalMeterCreditAmount, "270.00");
    assert.equal(summaryBody.data.summary.totalUnitsPurchased, "11.0000");
    assert.equal(summaryBody.data.paymentMethodBreakdown.paybillCompletedCount, 1);
    assert.equal(summaryBody.data.paymentMethodBreakdown.stkPushCompletedCount, 1);

    const recoveryResponse = await app.request(
      "/api/mobile/tenant-access/recovery-states?limit=10",
      {
        method: "GET",
        headers,
      },
    );
    assert.equal(recoveryResponse.status, 200);
    const recoveryBody = (await recoveryResponse.json()) as {
      count: number;
      data: {
        maskedToken: string | null;
        paymentStatus: string;
        recoveryState: string;
        transactionId: string;
      }[];
      pagination: {
        hasMore: boolean;
        limit: number | null;
        nextOffset: number | null;
        offset: number;
      };
    };
    assert.equal(recoveryBody.count, 5);
    assert.equal(recoveryBody.pagination.limit, 10);
    assert.equal(recoveryBody.pagination.offset, 0);
    assert.equal(recoveryBody.pagination.hasMore, false);
    assert.equal(recoveryBody.pagination.nextOffset, null);

    const byTransactionId = new Map(
      recoveryBody.data.map((item) => [item.transactionId, item]),
    );

    assert.equal(
      byTransactionId.get(pendingTx.transactionId)?.recoveryState,
      "payment_pending",
    );
    assert.equal(
      byTransactionId.get(processingTx.transactionId)?.recoveryState,
      "payment_processing",
    );
    assert.equal(
      byTransactionId.get(failedTx.transactionId)?.recoveryState,
      "payment_failed",
    );
    assert.equal(
      byTransactionId.get(completedTx.transactionId)?.recoveryState,
      "token_available",
    );
    assert.equal(
      byTransactionId.get(acknowledgedTx.transactionId)?.recoveryState,
      "token_acknowledged",
    );
    assert.equal(
      byTransactionId.get(completedTx.transactionId)?.maskedToken,
      "****************7890",
    );
  });
});
