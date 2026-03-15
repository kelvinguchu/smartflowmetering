import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { db } from "../../src/db";
import { generatedTokens, transactions } from "../../src/db/schema";
import { protectToken } from "../../src/lib/token-protection";
import { createApp } from "../../src/app";
import {
  createAuthenticatedSession,
  ensureInfraReady,
  ensureTestMeterFixture,
  teardownE2E,
  uniqueKenyanPhoneNumber,
  uniqueRef,
} from "./helpers";

const app = createApp();

void describe("E2E: RBAC permission matrix", () => {
  before(async () => {
    await ensureInfraReady();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("keeps support users on exact-match transaction and meter workflows", async () => {
    const fixture = await ensureTestMeterFixture();
    const userSession = await createAuthenticatedSession(app, "user");
    const phoneNumber = uniqueKenyanPhoneNumber();

    const [transaction] = await db
      .insert(transactions)
      .values({
        amountPaid: "150.00",
        commissionAmount: "15.00",
        meterId: fixture.meterId,
        mpesaReceiptNumber: uniqueRef("RCP-"),
        netAmount: "135.00",
        paymentMethod: "stk_push",
        phoneNumber,
        rateUsed: "25.0000",
        status: "completed",
        transactionId: uniqueRef("TX-"),
        unitsPurchased: "5.4000",
      })
      .returning();

    await db.insert(generatedTokens).values({
      generatedBy: "system",
      meterId: fixture.meterId,
      token: protectToken("12345678901234567890"),
      tokenType: "credit",
      transactionId: transaction.id,
      value: "5.4000",
    });

    const broadTransactionResponse = await app.request("/api/transactions", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(broadTransactionResponse.status, 403);

    const scopedTransactionResponse = await app.request(
      `/api/transactions?phoneNumber=${encodeURIComponent(phoneNumber)}`,
      {
        method: "GET",
        headers: userSession.headers,
      },
    );
    assert.equal(scopedTransactionResponse.status, 200);
    const scopedTransactionBody = (await scopedTransactionResponse.json()) as {
      data: Array<{
        commissionAmount?: string;
        generatedTokens: Array<{ token: string }>;
        id: string;
        transactionId: string;
      }>;
    };
    assert.equal(scopedTransactionBody.data.length, 1);
    assert.equal(scopedTransactionBody.data[0].id, transaction.id);
    assert.equal(
      Object.prototype.hasOwnProperty.call(scopedTransactionBody.data[0], "commissionAmount"),
      false,
    );
    assert.match(scopedTransactionBody.data[0].generatedTokens[0].token, /^\*+\d{4}$/);

    const transactionDetailResponse = await app.request(
      `/api/transactions/${transaction.id}`,
      {
        method: "GET",
        headers: userSession.headers,
      },
    );
    assert.equal(transactionDetailResponse.status, 403);

    const resendOverrideResponse = await app.request("/api/transactions/resend-token", {
      method: "POST",
      headers: userSession.headers,
      body: JSON.stringify({
        phoneNumber: uniqueKenyanPhoneNumber(),
        transactionId: transaction.id,
      }),
    });
    assert.equal(resendOverrideResponse.status, 403);

    const resendOriginalPhoneResponse = await app.request("/api/transactions/resend-token", {
      method: "POST",
      headers: userSession.headers,
      body: JSON.stringify({
        transactionId: transaction.id,
      }),
    });
    assert.equal(resendOriginalPhoneResponse.status, 200);

    const broadMeterResponse = await app.request("/api/meters", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(broadMeterResponse.status, 403);

    const scopedMeterResponse = await app.request(
      `/api/meters?meterNumber=${fixture.meterNumber}`,
      {
        method: "GET",
        headers: userSession.headers,
      },
    );
    assert.equal(scopedMeterResponse.status, 200);

    const lookupResponse = await app.request(
      `/api/meters/lookup/${fixture.meterNumber}`,
      {
        method: "GET",
        headers: userSession.headers,
      },
    );
    assert.equal(lookupResponse.status, 200);

    const meterDetailResponse = await app.request(`/api/meters/${fixture.meterId}`, {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(meterDetailResponse.status, 403);

    const motherMetersResponse = await app.request("/api/mother-meters", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(motherMetersResponse.status, 403);

    const balanceResponse = await app.request(
      `/api/mother-meters/${fixture.motherMeterId}/balance`,
      {
        method: "GET",
        headers: userSession.headers,
      },
    );
    assert.equal(balanceResponse.status, 403);

    const tariffsResponse = await app.request("/api/tariffs", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(tariffsResponse.status, 200);

    const smsResponse = await app.request("/api/sms/provider-health", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(smsResponse.status, 200);
  });

  void it("keeps admin-only transaction and mother meter actions restricted", async () => {
    const fixture = await ensureTestMeterFixture();
    const userSession = await createAuthenticatedSession(app, "user");
    const adminSession = await createAuthenticatedSession(app, "admin");

    const userSummaryResponse = await app.request("/api/transactions/stats/summary", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(userSummaryResponse.status, 403);

    const userReconciliationResponse = await app.request(
      `/api/mother-meters/${fixture.motherMeterId}/reconciliation`,
      {
        method: "GET",
        headers: userSession.headers,
      },
    );
    assert.equal(userReconciliationResponse.status, 403);

    const userEventResponse = await app.request(
      `/api/mother-meters/${fixture.motherMeterId}/events`,
      {
        method: "POST",
        headers: userSession.headers,
        body: JSON.stringify({
          amount: 1000,
          eventType: "refill",
          kplcReceiptNumber: "KPLC-TEST-001",
        }),
      },
    );
    assert.equal(userEventResponse.status, 403);

    const adminSummaryResponse = await app.request("/api/transactions/stats/summary", {
      method: "GET",
      headers: adminSession.headers,
    });
    assert.equal(adminSummaryResponse.status, 200);

    const adminMotherMetersResponse = await app.request("/api/mother-meters", {
      method: "GET",
      headers: adminSession.headers,
    });
    assert.equal(adminMotherMetersResponse.status, 200);

    const adminBalanceResponse = await app.request(
      `/api/mother-meters/${fixture.motherMeterId}/balance`,
      {
        method: "GET",
        headers: adminSession.headers,
      },
    );
    assert.equal(adminBalanceResponse.status, 200);

    const adminEventResponse = await app.request(
      `/api/mother-meters/${fixture.motherMeterId}/events`,
      {
        method: "POST",
        headers: adminSession.headers,
        body: JSON.stringify({
          amount: 1000,
          eventType: "refill",
          kplcReceiptNumber: "KPLC-TEST-002",
        }),
      },
    );
    assert.equal(adminEventResponse.status, 201);

    const adminReconciliationResponse = await app.request(
      `/api/mother-meters/${fixture.motherMeterId}/reconciliation`,
      {
        method: "GET",
        headers: adminSession.headers,
      },
    );
    assert.equal(adminReconciliationResponse.status, 200);
  });

});
