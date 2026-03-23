import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import {
  failedTransactions,
  mpesaTransactions,
  transactions,
} from "../../src/db/schema";
import {
  createGomelongProviderError,
  formatGomelongFailureDetails,
} from "../../src/services/meter-providers/gomelong-failure-policy";
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

describe("E2E: Gomelong failure workflow guidance", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  it("surfaces retry-aware manufacturer guidance on failed transactions and support recovery", async () => {
    const fixture = await ensureTestMeterFixture("GOMELONG-GUIDE-001");
    const adminSession = await createAuthenticatedSession(app, "admin");
    const staffSession = await createAuthenticatedSession(app, "user");
    const phoneNumber = uniqueKenyanPhoneNumber();
    const [mpesaTransaction] = await db
      .insert(mpesaTransactions)
      .values({
        billRefNumber: fixture.meterNumber,
        businessShortCode: "174379",
        msisdn: phoneNumber,
        rawPayload: {},
        transAmount: "220.00",
        transId: uniqueRef("RCP"),
        transTime: "20260320120000",
        transactionType: "Pay Bill",
      })
      .returning();

    await db.insert(transactions).values({
      amountPaid: "220.00",
      commissionAmount: "22.00",
      meterId: fixture.meterId,
      mpesaReceiptNumber: mpesaTransaction.transId,
      mpesaTransactionId: mpesaTransaction.id,
      netAmount: "198.00",
      paymentMethod: "stk_push",
      phoneNumber,
      rateUsed: "25.0000",
      status: "failed",
      transactionId: uniqueRef("OHM-"),
      unitsPurchased: "7.9200",
    });

    await db.insert(failedTransactions).values({
      amount: "220.00",
      failureDetails: formatGomelongFailureDetails(
        createGomelongProviderError({
          code: 5002,
          message: "temporary provider outage",
        }),
        { retriesExhausted: true },
      ),
      failureReason: "manufacturer_error",
      meterNumberAttempted: fixture.meterNumber,
      mpesaTransactionId: mpesaTransaction.id,
      phoneNumber,
      status: "pending_review",
    });

    const listResponse = await app.request(
      "/api/failed-transactions?status=pending_review&failureReason=manufacturer_error",
      {
        method: "GET",
        headers: adminSession.headers,
      },
    );

    assert.equal(listResponse.status, 200);
    const listBody = (await listResponse.json()) as {
      data: Array<{
        guidance: {
          closurePrecondition: string;
          providerRetryDisposition: string | null;
          recommendedAction: string;
          shouldRetrySameRequest: boolean | null;
          summary: string;
        };
        providerFailure: {
          disposition: string | null;
          retryable: boolean | null;
        } | null;
      }>;
    };

    assert.equal(listBody.data.length, 1);
    assert.equal(
      listBody.data[0].guidance.providerRetryDisposition,
      "retryable_retries_exhausted",
    );
    assert.equal(listBody.data[0].guidance.shouldRetrySameRequest, true);
    assert.match(
      listBody.data[0].guidance.recommendedAction,
      /retry token generation/i,
    );
    assert.match(listBody.data[0].guidance.summary, /safe to retry/i);
    assert.match(
      listBody.data[0].guidance.closurePrecondition,
      /retry path is exhausted/i,
    );
    assert.equal(
      listBody.data[0].providerFailure?.disposition,
      "retryable_retries_exhausted",
    );
    assert.equal(listBody.data[0].providerFailure?.retryable, true);

    const recoveryResponse = await app.request(
      `/api/support-recovery?meterNumber=${fixture.meterNumber}`,
      {
        method: "GET",
        headers: staffSession.headers,
      },
    );

    assert.equal(recoveryResponse.status, 200);
    const recoveryBody = (await recoveryResponse.json()) as {
      data: {
        transactions: Array<{
          failedTransactionReview: {
            guidance: {
              providerRetryDisposition: string | null;
              recommendedAction: string;
              shouldRetrySameRequest: boolean | null;
              summary: string;
            };
          } | null;
        }>;
      };
    };

    assert.equal(recoveryBody.data.transactions.length, 1);
    assert.equal(
      recoveryBody.data.transactions[0].failedTransactionReview?.guidance
        .providerRetryDisposition,
      "retryable_retries_exhausted",
    );
    assert.equal(
      recoveryBody.data.transactions[0].failedTransactionReview?.guidance
        .shouldRetrySameRequest,
      true,
    );
    assert.match(
      recoveryBody.data.transactions[0].failedTransactionReview?.guidance
        .recommendedAction ?? "",
      /retry token generation/i,
    );
    assert.match(
      recoveryBody.data.transactions[0].failedTransactionReview?.guidance
        .summary ?? "",
      /safe to retry/i,
    );
  });
});
