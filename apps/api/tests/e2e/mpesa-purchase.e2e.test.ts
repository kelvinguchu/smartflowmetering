import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import {
  failedTransactions,
  generatedTokens,
  mpesaTransactions,
  transactions,
} from "../../src/db/schema";
import { isProtectedToken, revealToken } from "../../src/lib/token-protection";
import {
  ensureTestMeterFixture,
  ensureInfraReady,
  resetE2EState,
  teardownE2E,
  uniqueRef,
  waitFor,
} from "./helpers";

const app = createApp();

const baseValidationPayload = {
  TransactionType: "Pay Bill",
  TransTime: "20260305120000",
  BusinessShortCode: "174379",
  BillRefNumber: "TEST-METER-001",
  MSISDN: "254712345678",
  FirstName: "Test",
  MiddleName: "User",
  LastName: "Flow",
};

async function postJson(path: string, payload: unknown) {
  const response = await app.request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Use a Safaricom-like source IP so tests pass in production-like envs too.
      "x-forwarded-for": "196.201.214.200",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as Record<string, unknown>;
  return { response, body };
}

async function setupTestMeter() {
  const fixture = await ensureTestMeterFixture("TEST-METER-001");
  assert.ok(fixture.meterId, "Expected test meter fixture to be created");
}

describe("E2E: M-Pesa purchase lifecycle", () => {
  before(async () => {
    process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
    await setupTestMeter();
  });

  after(async () => {
    await teardownE2E();
  });

  it("rejects validation when amount is below minimum", async () => {
    const { response, body } = await postJson("/api/mpesa/validation", {
      ...baseValidationPayload,
      TransID: uniqueRef("VALLOW"),
      TransAmount: 20,
    });

    assert.equal(response.status, 200);
    assert.equal(body.ResultCode, "C2B00012");
  });

  it("rejects validation when meter does not exist", async () => {
    const { response, body } = await postJson("/api/mpesa/validation", {
      ...baseValidationPayload,
      TransID: uniqueRef("VALMTR"),
      BillRefNumber: "UNKNOWN-METER-999",
      TransAmount: 100,
    });

    assert.equal(response.status, 200);
    assert.equal(body.ResultCode, "C2B00013");
  });

  it("processes callback end-to-end and generates token for paybill", async () => {
    const transId = uniqueRef("MPESA");

    const validation = await postJson("/api/mpesa/validation", {
      ...baseValidationPayload,
      TransID: transId,
      TransAmount: 100,
    });
    assert.equal(validation.body.ResultCode, "0");

    const callback = await postJson("/api/mpesa/callback", {
      ...baseValidationPayload,
      TransID: transId,
      TransAmount: 100,
    });
    assert.equal(callback.response.status, 200);
    assert.equal(callback.body.ResultCode, "0");

    await waitFor(async () => {
      const tx = await db.query.transactions.findFirst({
        where: eq(transactions.mpesaReceiptNumber, transId),
        columns: { status: true },
      });
      return tx?.status === "completed";
    });

    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.mpesaReceiptNumber, transId),
      columns: {
        id: true,
        paymentMethod: true,
        amountPaid: true,
        commissionAmount: true,
        netAmount: true,
        unitsPurchased: true,
        status: true,
      },
    });

    assert.ok(tx);
    assert.equal(tx.status, "completed");
    assert.equal(tx.paymentMethod, "paybill");
    assert.equal(tx.amountPaid, "100.00");
    assert.equal(tx.commissionAmount, "10.00");
    assert.equal(tx.netAmount, "90.00");
    assert.equal(tx.unitsPurchased, "3.6000");

    const [token] = await db
      .select({ token: generatedTokens.token })
      .from(generatedTokens)
      .where(eq(generatedTokens.transactionId, tx.id))
      .limit(1);

    assert.ok(token);
    assert.equal(isProtectedToken(token.token), true);
    assert.match(revealToken(token.token), /^\d{20}$/);
  });

  it("keeps callback idempotent and does not create duplicate transactions", async () => {
    const transId = uniqueRef("MPESAIDEMP");

    await postJson("/api/mpesa/callback", {
      ...baseValidationPayload,
      TransID: transId,
      TransAmount: 200,
    });
    await postJson("/api/mpesa/callback", {
      ...baseValidationPayload,
      TransID: transId,
      TransAmount: 200,
    });

    await waitFor(async () => {
      const rows = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.mpesaReceiptNumber, transId));
      return rows.length === 1;
    });

    const rows = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.mpesaReceiptNumber, transId));
    assert.equal(rows.length, 1);
  });

  it("records failed transaction when callback meter is invalid", async () => {
    const transId = uniqueRef("MPESAFAIL");

    const callback = await postJson("/api/mpesa/callback", {
      ...baseValidationPayload,
      TransID: transId,
      BillRefNumber: "UNKNOWN-METER-404",
      TransAmount: 300,
    });

    assert.equal(callback.response.status, 200);
    assert.equal(callback.body.ResultCode, "0");

    await waitFor(async () => {
      const mpesa = await db.query.mpesaTransactions.findFirst({
        where: eq(mpesaTransactions.transId, transId),
        columns: { id: true },
      });
      if (!mpesa) return false;
      const failure = await db.query.failedTransactions.findFirst({
        where: eq(failedTransactions.mpesaTransactionId, mpesa.id),
        columns: { id: true },
      });
      return Boolean(failure);
    });

    const mpesa = await db.query.mpesaTransactions.findFirst({
      where: eq(mpesaTransactions.transId, transId),
      columns: { id: true },
    });
    assert.ok(mpesa);

    const failure = await db.query.failedTransactions.findFirst({
      where: eq(failedTransactions.mpesaTransactionId, mpesa.id),
      columns: { failureReason: true, meterNumberAttempted: true },
    });
    assert.ok(failure);
    assert.equal(failure.failureReason, "invalid_meter");
    assert.equal(failure.meterNumberAttempted, "UNKNOWN-METER-404");
  });

  it("processes STK callback and stores stk_push payment method", async () => {
    const checkoutRequestId = uniqueRef("ws_CO_");
    const [pendingTx] = await db
      .insert(mpesaTransactions)
      .values({
        transactionType: "STK_PUSH",
        transId: checkoutRequestId,
        transTime: "20260305123000",
        transAmount: "150.00",
        businessShortCode: "174379",
        billRefNumber: "TEST-METER-001",
        msisdn: "254712345678",
        status: "pending",
        rawPayload: { source: "e2e-test" },
      })
      .returning({ id: mpesaTransactions.id });

    const mockReceipt = uniqueRef("RCP");
    const callback = await postJson("/api/mpesa/stk-push/callback", {
      Body: {
        stkCallback: {
          MerchantRequestID: uniqueRef("MRQ"),
          CheckoutRequestID: checkoutRequestId,
          ResultCode: 0,
          ResultDesc: "The service request is processed successfully.",
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: 150 },
              { Name: "MpesaReceiptNumber", Value: mockReceipt },
              { Name: "TransactionDate", Value: 20260305123000 },
              { Name: "PhoneNumber", Value: 254712345678 },
            ],
          },
        },
      },
    });

    assert.equal(callback.response.status, 200);
    assert.equal(callback.body.ResultCode, "0");

    await waitFor(async () => {
      const tx = await db.query.transactions.findFirst({
        where: and(
          eq(transactions.mpesaTransactionId, pendingTx.id),
          eq(transactions.paymentMethod, "stk_push")
        ),
        columns: { status: true },
      });
      return tx?.status === "completed";
    });

    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.mpesaTransactionId, pendingTx.id),
      columns: { paymentMethod: true, status: true },
    });
    assert.ok(tx);
    assert.equal(tx.paymentMethod, "stk_push");
    assert.equal(tx.status, "completed");
  });
});
