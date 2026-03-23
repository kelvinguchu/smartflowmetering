import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import { transactions } from "../../src/db/schema";
import {
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
  uniqueRef,
} from "./helpers";

const app = createApp();

void describe("E2E: tenant dashboard", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("returns tenant summary, purchases, and purchase rollups for the authenticated meter", async () => {
    const fixture = await ensureTestMeterFixture("TENANT-METER-002A");
    await db.insert(transactions).values([
      {
        amountPaid: "111.11",
        commissionAmount: "11.11",
        completedAt: new Date("2026-03-14T08:00:00.000Z"),
        meterId: fixture.meterId,
        mpesaReceiptNumber: uniqueRef("MPESA"),
        netAmount: "100.00",
        paymentMethod: "paybill",
        phoneNumber: "254700111222",
        rateUsed: "25.0000",
        status: "completed",
        transactionId: uniqueRef("OHM"),
        unitsPurchased: "4.0000",
      },
      {
        amountPaid: "166.67",
        commissionAmount: "16.67",
        completedAt: new Date("2026-03-15T09:00:00.000Z"),
        meterId: fixture.meterId,
        mpesaReceiptNumber: uniqueRef("MPESA"),
        netAmount: "150.00",
        paymentMethod: "stk_push",
        phoneNumber: "254711222333",
        rateUsed: "25.0000",
        status: "completed",
        transactionId: uniqueRef("OHM"),
        unitsPurchased: "6.0000",
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
    const headers = {
      Authorization: `Bearer ${bootstrapBody.data.accessToken}`,
    };

    const summaryResponse = await app.request("/api/mobile/tenant-access/summary", {
      method: "GET",
      headers,
    });
    assert.equal(summaryResponse.status, 200);
    const summaryBody = (await summaryResponse.json()) as {
      data: {
        activity: { totalCompletedPurchases: number };
        meter: { id?: string; meterNumber: string; status: string };
        motherMeter: { id?: string; motherMeterNumber: string };
        property: { id?: string; name: string };
        totals: { totalMeterCreditAmount: string; totalUnitsPurchased: string };
      };
    };
    assert.equal(summaryBody.data.meter.meterNumber, fixture.meterNumber);
    assert.equal(summaryBody.data.meter.status, "active");
    assert.equal("id" in summaryBody.data.meter, false);
    assert.equal("id" in summaryBody.data.motherMeter, false);
    assert.equal("id" in summaryBody.data.property, false);
    assert.equal(summaryBody.data.activity.totalCompletedPurchases, 2);
    assert.equal(summaryBody.data.totals.totalMeterCreditAmount, "250.00");
    assert.equal(summaryBody.data.totals.totalUnitsPurchased, "10.0000");

    const purchasesResponse = await app.request(
      "/api/mobile/tenant-access/purchases?limit=10",
      {
        method: "GET",
        headers,
      },
    );
    assert.equal(purchasesResponse.status, 200);
    const purchasesBody = (await purchasesResponse.json()) as {
      count: number;
      data: {
        meterCreditAmount: string;
        paymentMethod: string;
        transactionId: string;
        unitsPurchased: string;
      }[];
      pagination: {
        hasMore: boolean;
        limit: number | null;
        nextOffset: number | null;
        offset: number;
      };
    };
    assert.equal(purchasesBody.count, 2);
    assert.equal(purchasesBody.pagination.limit, 10);
    assert.equal(purchasesBody.pagination.offset, 0);
    assert.equal(purchasesBody.pagination.hasMore, false);
    assert.equal(purchasesBody.pagination.nextOffset, null);
    assert.equal(purchasesBody.data[0]?.meterCreditAmount, "150.00");
    assert.equal(purchasesBody.data[0]?.paymentMethod, "stk_push");
    assert.equal(purchasesBody.data[0]?.unitsPurchased, "6.0000");
    assert.ok(purchasesBody.data[0]?.transactionId);

    const rollupResponse = await app.request(
      "/api/mobile/tenant-access/purchase-rollups?limit=10",
      {
        method: "GET",
        headers,
      },
    );
    assert.equal(rollupResponse.status, 200);
    const rollupBody = (await rollupResponse.json()) as {
      count: number;
      data: {
        bucket: string;
        bucketMeta: { endDate: string; key: string; startDate: string };
        cumulativeMeterCreditAmount: string;
        granularity: string;
        totals: { meterCreditAmount: string; purchaseCount: number };
      }[];
      pagination: {
        hasMore: boolean;
        limit: number | null;
        nextOffset: number | null;
        offset: number;
      };
    };
    assert.equal(rollupBody.count, 2);
    assert.equal(rollupBody.pagination.limit, 10);
    assert.equal(rollupBody.pagination.offset, 0);
    assert.equal(rollupBody.pagination.hasMore, false);
    assert.equal(rollupBody.pagination.nextOffset, null);
    assert.equal(rollupBody.data[0]?.bucket, "2026-03-15");
    assert.equal(rollupBody.data[0]?.bucketMeta.key, "2026-03-15");
    assert.equal(rollupBody.data[0]?.bucketMeta.startDate, "2026-03-15");
    assert.equal(rollupBody.data[0]?.bucketMeta.endDate, "2026-03-15");
    assert.equal(rollupBody.data[0]?.granularity, "day");
    assert.equal(rollupBody.data[0]?.totals.purchaseCount, 1);
    assert.equal(rollupBody.data[0]?.totals.meterCreditAmount, "150.00");
    assert.equal(rollupBody.data[0]?.cumulativeMeterCreditAmount, "250.00");
  });
});
