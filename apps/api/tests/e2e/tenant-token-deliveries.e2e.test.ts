import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import {
  customerAppNotifications,
  generatedTokens,
  smsLogs,
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
import { getLatestTenantAccessIdForMeter } from "./tenant-access-test-helpers";

const app = createApp();

void describe("E2E: tenant token deliveries", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("returns tenant-safe token delivery status for recent completed purchases", async () => {
    const fixture = await ensureTestMeterFixture("TENANT-METER-002B");
    const [firstTransaction, secondTransaction] = await db
      .insert(transactions)
      .values([
        {
          amountPaid: "133.33",
          commissionAmount: "13.33",
          completedAt: new Date("2026-03-16T08:00:00.000Z"),
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
          completedAt: new Date("2026-03-16T10:00:00.000Z"),
          meterId: fixture.meterId,
          mpesaReceiptNumber: uniqueRef("MPESA"),
          netAmount: "150.00",
          paymentMethod: "stk_push",
          phoneNumber: "254700666777",
          rateUsed: "25.0000",
          status: "completed",
          transactionId: uniqueRef("OHM"),
          unitsPurchased: "6.0000",
        },
      ])
      .returning({ id: transactions.id, transactionId: transactions.transactionId });

    await db.insert(generatedTokens).values({
      generatedBy: "system",
      meterId: fixture.meterId,
      token: protectToken("12345678901234567890"),
      tokenType: "credit",
      transactionId: firstTransaction.id,
      value: "5.0000",
    });

    const bootstrapResponse = await app.request(
      "/api/mobile/tenant-access/bootstrap",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meterNumber: fixture.meterNumber }),
      },
    );
    const bootstrapBody = (await bootstrapResponse.json()) as {
      data: { accessToken: string };
    };

    const response = await app.request(
      "/api/mobile/tenant-access/token-deliveries?limit=10",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${bootstrapBody.data.accessToken}`,
        },
      },
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      count: number;
      data: {
        maskedToken: string | null;
        status: string;
        tokenGeneratedAt: string | null;
        transactionId: string;
      }[];
      pagination: {
        hasMore: boolean;
        limit: number | null;
        nextOffset: number | null;
        offset: number;
      };
    };
    assert.equal(body.count, 2);
    assert.equal(body.pagination.limit, 10);
    assert.equal(body.pagination.offset, 0);
    assert.equal(body.pagination.hasMore, false);
    assert.equal(body.pagination.nextOffset, null);
    assert.equal(body.data[0]?.transactionId, secondTransaction.transactionId);
    assert.equal(body.data[0]?.status, "pending_token");
    assert.equal(body.data[0]?.maskedToken, null);
    assert.equal(body.data[1]?.transactionId, firstTransaction.transactionId);
    assert.equal(body.data[1]?.status, "token_available");
    assert.equal(body.data[1]?.maskedToken, "****************7890");
    assert.ok(body.data[1]?.tokenGeneratedAt);
  });

  void it("returns tenant-safe token delivery detail with SMS state", async () => {
    const fixture = await ensureTestMeterFixture("TENANT-TOKEN-METER-001");
    const [transaction] = await db
      .insert(transactions)
      .values({
        amountPaid: "133.33",
        commissionAmount: "13.33",
        completedAt: new Date("2026-03-17T10:00:00.000Z"),
        meterId: fixture.meterId,
        mpesaReceiptNumber: uniqueRef("MPESA"),
        netAmount: "120.00",
        paymentMethod: "paybill",
        phoneNumber: "254700444555",
        rateUsed: "24.0000",
        status: "completed",
        transactionId: uniqueRef("OHM"),
        unitsPurchased: "5.0000",
      })
      .returning({ id: transactions.id, transactionId: transactions.transactionId });

    await db.insert(generatedTokens).values({
      generatedBy: "system",
      meterId: fixture.meterId,
      token: protectToken("12345678901234567890"),
      tokenType: "credit",
      transactionId: transaction.id,
      value: "5.0000",
    });

    await db.insert(smsLogs).values({
      messageBody: "Token SMS",
      phoneNumber: "254700444555",
      provider: "hostpinnacle",
      providerDeliveredAt: new Date("2026-03-17T10:03:00.000Z"),
      providerErrorCode: null,
      providerReceivedAt: new Date("2026-03-17T10:02:00.000Z"),
      providerStatus: "DELIVRD",
      status: "delivered",
      transactionId: transaction.id,
    });

    const bootstrapResponse = await app.request(
      "/api/mobile/tenant-access/bootstrap",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meterNumber: fixture.meterNumber }),
      },
    );
    const bootstrapBody = (await bootstrapResponse.json()) as {
      data: { accessToken: string };
    };

    const response = await app.request(
      `/api/mobile/tenant-access/token-deliveries/${transaction.transactionId}`,
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
        maskedToken: string | null;
        smsDelivery: {
          status: string;
          updatedAt: string;
        } | null;
        status: string;
        transactionId: string;
      };
    };
    assert.equal(body.data.transactionId, transaction.transactionId);
    assert.equal(body.data.status, "token_available");
    assert.equal(body.data.maskedToken, "****************7890");
    assert.ok(body.data.smsDelivery);
    assert.equal(body.data.smsDelivery.status, "delivered");
    assert.ok(body.data.smsDelivery.updatedAt);
    assert.equal(
      Object.prototype.hasOwnProperty.call(body.data.smsDelivery, "providerStatus"),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(body.data.smsDelivery, "provider"),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(body.data.smsDelivery, "errorCode"),
      false,
    );
  });

  void it("acknowledges a tenant token-delivery notification by transaction reference", async () => {
    const fixture = await ensureTestMeterFixture("TENANT-TOKEN-METER-002");
    const [transaction] = await db
      .insert(transactions)
      .values({
        amountPaid: "111.11",
        commissionAmount: "11.11",
        completedAt: new Date("2026-03-17T12:00:00.000Z"),
        meterId: fixture.meterId,
        mpesaReceiptNumber: uniqueRef("MPESA"),
        netAmount: "100.00",
        paymentMethod: "paybill",
        phoneNumber: "254700123123",
        rateUsed: "25.0000",
        status: "completed",
        transactionId: uniqueRef("OHM"),
        unitsPurchased: "4.0000",
      })
      .returning({ transactionId: transactions.transactionId });

    const bootstrapResponse = await app.request(
      "/api/mobile/tenant-access/bootstrap",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meterNumber: fixture.meterNumber }),
      },
    );
    const bootstrapBody = (await bootstrapResponse.json()) as {
      data: { accessToken: string };
    };
    const tenantAccessId = await getLatestTenantAccessIdForMeter(fixture.meterId);

    await db.insert(customerAppNotifications).values({
      message: "Your token is ready in the app.",
      meterNumber: fixture.meterNumber,
      referenceId: transaction.transactionId,
      tenantAccessId,
      title: "Token ready",
      type: "token_delivery_available",
    });

    const response = await app.request(
      `/api/mobile/tenant-access/token-deliveries/${transaction.transactionId}/acknowledge`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bootstrapBody.data.accessToken}`,
        },
      },
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      data: {
        acknowledgedAt: string;
        acknowledgedCount: number;
        transactionId: string;
      };
    };
    assert.equal(body.data.transactionId, transaction.transactionId);
    assert.equal(body.data.acknowledgedCount, 1);
    assert.ok(body.data.acknowledgedAt);
  });
});
