import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import {
  failedTransactions,
  motherMeterEvents,
  smsLogs,
  transactions,
} from "../../src/db/schema";
import {
  createAuthenticatedSession,
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
  uniqueRef,
  waitFor,
} from "./helpers";

const app = createApp();

const baseCallbackPayload = {
  TransactionType: "Pay Bill",
  TransTime: "20260305120000",
  BusinessShortCode: "174379",
  MSISDN: "254712345678",
  FirstName: "Rec",
  MiddleName: "On",
  LastName: "Cile",
};

async function postMpesaCallback(payload: Record<string, unknown>) {
  const response = await app.request("/api/mpesa/callback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "196.201.214.200",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as Record<string, unknown>;
  return { response, body };
}

describe("E2E: Reconciliation and recovery admin actions", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  it("allows admin to review and resolve a failed transaction", async () => {
    await ensureTestMeterFixture("TEST-METER-REC-1");
    const adminSession = await createAuthenticatedSession(app, "admin");

    const receipt = uniqueRef("REC-FAIL-");
    const callback = await postMpesaCallback({
      ...baseCallbackPayload,
      TransID: receipt,
      BillRefNumber: "UNKNOWN-METER-RECON",
      TransAmount: 120,
    });
    assert.equal(callback.response.status, 200);
    assert.equal(callback.body.ResultCode, "0");

    await waitFor(async () => {
      const row = await db.query.failedTransactions.findFirst({
        columns: { id: true },
      });
      return Boolean(row);
    });

    const [failure] = await db
      .select({ id: failedTransactions.id, status: failedTransactions.status })
      .from(failedTransactions)
      .limit(1);
    assert.ok(failure);
    assert.equal(failure.status, "pending_review");

    const listResponse = await app.request(
      "/api/failed-transactions?status=pending_review",
      {
        method: "GET",
        headers: adminSession.headers,
      }
    );
    const listBody = (await listResponse.json()) as {
      count: number;
      data: Array<{ id: string; status: string }>;
    };

    assert.equal(listResponse.status, 200);
    assert.ok(listBody.count >= 1);
    assert.ok(listBody.data.some((item) => item.id === failure.id));

    const updateResponse = await app.request(
      `/api/failed-transactions/${failure.id}/status`,
      {
        method: "PATCH",
        headers: adminSession.headers,
        body: JSON.stringify({
          status: "resolved",
          resolutionNotes: "Reviewed and closed after customer support follow-up",
        }),
      }
    );
    const updateBody = (await updateResponse.json()) as {
      data: { status: string; resolutionNotes: string; resolvedAt: string | null };
    };

    assert.equal(updateResponse.status, 200);
    assert.equal(updateBody.data.status, "resolved");
    assert.equal(
      updateBody.data.resolutionNotes,
      "Reviewed and closed after customer support follow-up"
    );
    assert.ok(updateBody.data.resolvedAt);
  });

  it("supports reconciliation endpoint and resend/recovery flows", async () => {
    const fixture = await ensureTestMeterFixture("TEST-METER-REC-2");
    const adminSession = await createAuthenticatedSession(app, "admin");

    const receipt = uniqueRef("REC-OK-");
    const callback = await postMpesaCallback({
      ...baseCallbackPayload,
      TransID: receipt,
      BillRefNumber: "TEST-METER-REC-2",
      TransAmount: 200,
    });
    assert.equal(callback.response.status, 200);

    await waitFor(async () => {
      const tx = await db.query.transactions.findFirst({
        where: eq(transactions.mpesaReceiptNumber, receipt),
        columns: { status: true },
      });
      return tx?.status === "completed";
    });

    await waitFor(async () => {
      const tx = await db.query.transactions.findFirst({
        where: eq(transactions.mpesaReceiptNumber, receipt),
        columns: { id: true },
      });
      if (!tx) return false;
      const logs = await db
        .select({ id: smsLogs.id })
        .from(smsLogs)
        .where(eq(smsLogs.transactionId, tx.id));
      return logs.length >= 1;
    });

    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.mpesaReceiptNumber, receipt),
      columns: { id: true },
    });
    assert.ok(tx);

    const resendTokenResponse = await app.request("/api/transactions/resend-token", {
      method: "POST",
      headers: adminSession.headers,
      body: JSON.stringify({
        transactionId: tx.id,
      }),
    });
    const resendTokenBody = (await resendTokenResponse.json()) as {
      success: boolean;
      smsLogId: string;
    };

    assert.equal(resendTokenResponse.status, 200);
    assert.equal(resendTokenBody.success, true);
    assert.ok(resendTokenBody.smsLogId);

    const smsResendResponse = await app.request(
      `/api/sms/resend/${resendTokenBody.smsLogId}`,
      {
        method: "POST",
        headers: adminSession.headers,
      }
    );
    assert.equal(smsResendResponse.status, 200);

    await db.insert(motherMeterEvents).values({
      motherMeterId: fixture.motherMeterId,
      eventType: "bill_payment",
      amount: "500.00",
      performedBy: "00000000-0000-0000-0000-000000000000",
      createdAt: new Date(),
    });

    const reconciliationResponse = await app.request(
      `/api/mother-meters/${fixture.motherMeterId}/reconciliation`,
      {
        method: "GET",
        headers: adminSession.headers,
      }
    );
    const reconciliationBody = (await reconciliationResponse.json()) as {
      data?: {
        motherMeterId: string;
        netSalesCollected: string;
        kplcPayments: string;
      };
    };

    assert.equal(reconciliationResponse.status, 200);
    assert.equal(reconciliationBody.data?.motherMeterId, fixture.motherMeterId);
    assert.ok(reconciliationBody.data?.netSalesCollected);
    assert.ok(reconciliationBody.data?.kplcPayments);

    const smsRows = await db
      .select({ id: smsLogs.id })
      .from(smsLogs)
      .where(and(eq(smsLogs.transactionId, tx.id)));
    assert.ok(smsRows.length >= 2);
  });
});
