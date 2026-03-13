import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import { smsLogs, transactions } from "../../src/db/schema";
import {
  createAuthenticatedSession,
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
  uniqueKenyanPhoneNumber,
  uniqueRef,
} from "./helpers";

const app = createApp();

void describe("E2E: sms recovery", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("lists failed sms recovery items for support staff", async () => {
    const fixture = await ensureTestMeterFixture("SMS-RECOVERY-001");
    const staffSession = await createAuthenticatedSession(app, "user");
    const phoneNumber = uniqueKenyanPhoneNumber();
    const [transaction] = await db
      .insert(transactions)
      .values({
        amountPaid: "200.00",
        commissionAmount: "20.00",
        meterId: fixture.meterId,
        mpesaReceiptNumber: uniqueRef("RCP"),
        netAmount: "180.00",
        paymentMethod: "stk_push",
        phoneNumber,
        rateUsed: "25.0000",
        status: "completed",
        transactionId: uniqueRef("OHM-"),
        unitsPurchased: "7.2000",
      })
      .returning({ id: transactions.id, transactionId: transactions.transactionId });

    const [failedLog] = await db
      .insert(smsLogs)
      .values({
        messageBody: "Token ***************7890 failed",
        phoneNumber,
        provider: "hostpinnacle",
        providerErrorCode: "104",
        providerStatus: "Failed",
        status: "failed",
        transactionId: transaction.id,
      })
      .returning({ id: smsLogs.id });

    await db.insert(smsLogs).values({
      messageBody: "Token ***************7890 delivered",
      phoneNumber,
      provider: "hostpinnacle",
      providerStatus: "Delivered",
      status: "delivered",
      transactionId: transaction.id,
    });

    const response = await app.request(
      `/api/sms/recovery?phoneNumber=${phoneNumber}&deliveryState=failed`,
      {
        method: "GET",
        headers: staffSession.headers,
      },
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      data: {
        id: string;
        providerErrorCode: string | null;
        providerStatus: string | null;
        retryEligible: boolean;
        status: string;
        transaction: { transactionId: string } | null;
      }[];
      summary: { delivered: number; failed: number; pending: number; total: number };
    };

    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].id, failedLog.id);
    assert.equal(body.data[0].status, "failed");
    assert.equal(body.data[0].providerStatus, "Failed");
    assert.equal(body.data[0].providerErrorCode, "104");
    assert.equal(body.data[0].retryEligible, true);
    assert.equal(body.data[0].transaction?.transactionId, transaction.transactionId);
    assert.equal(body.summary.failed, 1);
    assert.equal(body.summary.delivered, 0);
  });

  void it("queues single and batch retries", async () => {
    const staffSession = await createAuthenticatedSession(app, "user");
    const phoneNumber = uniqueKenyanPhoneNumber();
    const [firstLog] = await db
      .insert(smsLogs)
      .values({
        messageBody: "Reminder A",
        phoneNumber,
        provider: "hostpinnacle",
        status: "failed",
      })
      .returning({ id: smsLogs.id });

    const [secondLog] = await db
      .insert(smsLogs)
      .values({
        messageBody: "Reminder B",
        phoneNumber,
        provider: "hostpinnacle",
        status: "queued",
      })
      .returning({ id: smsLogs.id });

    const retryResponse = await app.request(`/api/sms/recovery/${firstLog.id}/retry`, {
      method: "POST",
      headers: staffSession.headers,
    });
    assert.equal(retryResponse.status, 200);

    const batchResponse = await app.request("/api/sms/recovery/retry-batch", {
      method: "POST",
      headers: staffSession.headers,
      body: JSON.stringify({ ids: [firstLog.id, secondLog.id] }),
    });
    assert.equal(batchResponse.status, 200);
    const batchBody = (await batchResponse.json()) as {
      failed: number;
      queued: number;
      results: { id: string; ok: boolean }[];
    };
    assert.equal(batchBody.failed, 0);
    assert.equal(batchBody.queued, 2);
    assert.equal(batchBody.results.length, 2);
    assert.ok(batchBody.results.every((result) => result.ok));
  });
});
