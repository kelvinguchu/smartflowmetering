import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { env } from "../../src/config";
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
const originalFetch = globalThis.fetch;
const originalTextSmsEnv = {
  apiKey: env.TEXTSMS_API_KEY,
  dlrApiUrl: env.TEXTSMS_DLR_API_URL,
  partnerId: env.TEXTSMS_PARTNER_ID,
};

function requestTarget(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input.url;
}

void describe("E2E: sms recovery", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    globalThis.fetch = originalFetch;
    Object.assign(env, {
      TEXTSMS_API_KEY: originalTextSmsEnv.apiKey,
      TEXTSMS_DLR_API_URL: originalTextSmsEnv.dlrApiUrl,
      TEXTSMS_PARTNER_ID: originalTextSmsEnv.partnerId,
    });
    await teardownE2E();
  });

  void it("lists failed sms recovery items for support staff", async () => {
    const fixture = await ensureTestMeterFixture("SMS-RECOVERY-001");
    const staffSession = await createAuthenticatedSession(app, "user");
    const adminSession = await createAuthenticatedSession(app, "admin");
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
      .returning({
        id: transactions.id,
        transactionId: transactions.transactionId,
      });

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
        provider: "hostpinnacle" | "textsms";
        retryEligible: boolean;
        status: string;
        transaction: { transactionId: string } | null;
      }[];
      summary: {
        delivered: number;
        failed: number;
        pending: number;
        total: number;
      };
    };

    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].id, failedLog.id);
    assert.equal(body.data[0].provider, "hostpinnacle");
    assert.equal(body.data[0].status, "failed");
    assert.equal(body.data[0].retryEligible, true);
    assert.equal(
      body.data[0].transaction?.transactionId,
      transaction.transactionId,
    );
    assert.equal("providerStatus" in body.data[0], false);
    assert.equal("providerMessageId" in body.data[0], false);
    assert.equal("cost" in body.data[0], false);
    assert.equal("providerErrorCode" in body.data[0], false);
    assert.equal(body.summary.failed, 1);
    assert.equal(body.summary.delivered, 0);

    const adminResponse = await app.request(
      `/api/sms/recovery?phoneNumber=${phoneNumber}&deliveryState=failed`,
      {
        method: "GET",
        headers: adminSession.headers,
      },
    );
    assert.equal(adminResponse.status, 200);
    const adminBody = (await adminResponse.json()) as {
      data: {
        providerErrorCode: string | null;
        providerStatus: string | null;
      }[];
    };
    assert.equal(adminBody.data[0].providerStatus, "Failed");
    assert.equal(adminBody.data[0].providerErrorCode, "104");
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

    const retryResponse = await app.request(
      `/api/sms/recovery/${firstLog.id}/retry?phoneNumber=${phoneNumber}`,
      {
        method: "POST",
        headers: staffSession.headers,
      },
    );
    assert.equal(retryResponse.status, 200);

    const batchResponse = await app.request(
      `/api/sms/recovery/retry-batch?phoneNumber=${phoneNumber}`,
      {
        method: "POST",
        headers: staffSession.headers,
        body: JSON.stringify({ ids: [firstLog.id, secondLog.id] }),
      },
    );
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

  void it("syncs TextSMS delivery status for support staff", async () => {
    const staffSession = await createAuthenticatedSession(app, "user");
    const phoneNumber = uniqueKenyanPhoneNumber();
    const [smsLog] = await db
      .insert(smsLogs)
      .values({
        messageBody: "Token ***************1234 sent",
        phoneNumber,
        provider: "textsms",
        providerMessageId: "TS-001",
        status: "sent",
      })
      .returning({ id: smsLogs.id });

    Object.assign(env, {
      TEXTSMS_API_KEY: "text-key",
      TEXTSMS_DLR_API_URL: "https://textsms.example/getdlr",
      TEXTSMS_PARTNER_ID: "12345",
    });

    globalThis.fetch = ((input: RequestInfo | URL) => {
      assert.equal(requestTarget(input), "https://textsms.example/getdlr");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            responses: [
              {
                "respose-code": 200,
                "response-description": "Delivered",
                deliveredTime: "2026-03-15T12:00:00+03:00",
                messageid: "TS-001",
                status: "Delivered",
              },
            ],
          }),
          { status: 200 },
        ),
      );
    }) as typeof fetch;

    const response = await app.request(
      `/api/sms/recovery/${smsLog.id}/sync-status?phoneNumber=${phoneNumber}`,
      {
        method: "POST",
        headers: staffSession.headers,
      },
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      smsLogId: string;
      status: "delivered" | "failed" | "sent" | null;
      synced: boolean;
    };

    assert.equal(body.smsLogId, smsLog.id);
    assert.equal(body.status, "delivered");
    assert.equal(body.synced, true);
    assert.equal("provider" in body, false);
    assert.equal("providerMessageId" in body, false);

    const updatedLog = await db.query.smsLogs.findFirst({
      where: (table, { eq }) => eq(table.id, smsLog.id),
      columns: {
        providerStatus: true,
        status: true,
      },
    });

    assert.ok(updatedLog);
    assert.equal(updatedLog.status, "delivered");
    assert.equal(updatedLog.providerStatus, "Delivered");
  });

  void it("requires support staff to scope sms recovery retry and sync operations", async () => {
    const fixture = await ensureTestMeterFixture("SMS-RECOVERY-SCOPE-001");
    const staffSession = await createAuthenticatedSession(app, "user");
    const adminSession = await createAuthenticatedSession(app, "admin");
    const phoneNumber = uniqueKenyanPhoneNumber();
    const mismatchedPhoneNumber = uniqueKenyanPhoneNumber();
    const [transaction] = await db
      .insert(transactions)
      .values({
        amountPaid: "150.00",
        commissionAmount: "15.00",
        meterId: fixture.meterId,
        mpesaReceiptNumber: uniqueRef("RCP-SCOPE-"),
        netAmount: "135.00",
        paymentMethod: "stk_push",
        phoneNumber,
        rateUsed: "25.0000",
        status: "completed",
        transactionId: uniqueRef("OHM-SCOPE-"),
        unitsPurchased: "5.4000",
      })
      .returning({
        id: transactions.id,
        transactionId: transactions.transactionId,
      });

    const [retryLog] = await db
      .insert(smsLogs)
      .values({
        messageBody: "Retry me",
        phoneNumber,
        provider: "hostpinnacle",
        status: "failed",
        transactionId: transaction.id,
      })
      .returning({ id: smsLogs.id });

    const [syncLog] = await db
      .insert(smsLogs)
      .values({
        messageBody: "Sync me",
        phoneNumber,
        provider: "textsms",
        providerMessageId: "TS-SCOPE-001",
        status: "sent",
        transactionId: transaction.id,
      })
      .returning({ id: smsLogs.id });

    Object.assign(env, {
      TEXTSMS_API_KEY: "text-key",
      TEXTSMS_DLR_API_URL: "https://textsms.example/getdlr",
      TEXTSMS_PARTNER_ID: "12345",
    });

    globalThis.fetch = ((input: RequestInfo | URL) => {
      assert.equal(requestTarget(input), "https://textsms.example/getdlr");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            responses: [
              {
                "respose-code": 200,
                "response-description": "Delivered",
                deliveredTime: "2026-03-15T12:00:00+03:00",
                messageid: "TS-SCOPE-001",
                status: "Delivered",
              },
            ],
          }),
          { status: 200 },
        ),
      );
    }) as typeof fetch;

    const unscopedRetry = await app.request(
      `/api/sms/recovery/${retryLog.id}/retry`,
      {
        method: "POST",
        headers: staffSession.headers,
      },
    );
    assert.equal(unscopedRetry.status, 403);

    const mismatchedRetry = await app.request(
      `/api/sms/recovery/${retryLog.id}/retry?phoneNumber=${mismatchedPhoneNumber}`,
      {
        method: "POST",
        headers: staffSession.headers,
      },
    );
    assert.equal(mismatchedRetry.status, 403);

    const scopedRetry = await app.request(
      `/api/sms/recovery/${retryLog.id}/retry?phoneNumber=${phoneNumber}`,
      {
        method: "POST",
        headers: staffSession.headers,
      },
    );
    assert.equal(scopedRetry.status, 200);

    const batchUnscoped = await app.request("/api/sms/recovery/retry-batch", {
      method: "POST",
      headers: staffSession.headers,
      body: JSON.stringify({ ids: [retryLog.id] }),
    });
    assert.equal(batchUnscoped.status, 403);

    const batchMismatched = await app.request(
      `/api/sms/recovery/retry-batch?transactionId=${uniqueRef("OTHER-")}`,
      {
        method: "POST",
        headers: staffSession.headers,
        body: JSON.stringify({ ids: [retryLog.id] }),
      },
    );
    assert.equal(batchMismatched.status, 403);

    const batchScoped = await app.request(
      `/api/sms/recovery/retry-batch?transactionId=${transaction.transactionId}`,
      {
        method: "POST",
        headers: staffSession.headers,
        body: JSON.stringify({ ids: [retryLog.id] }),
      },
    );
    assert.equal(batchScoped.status, 200);

    const unscopedSync = await app.request(
      `/api/sms/recovery/${syncLog.id}/sync-status`,
      {
        method: "POST",
        headers: staffSession.headers,
      },
    );
    assert.equal(unscopedSync.status, 403);

    const mismatchedSync = await app.request(
      `/api/sms/recovery/${syncLog.id}/sync-status?meterNumber=WRONG-METER`,
      {
        method: "POST",
        headers: staffSession.headers,
      },
    );
    assert.equal(mismatchedSync.status, 403);

    const scopedSync = await app.request(
      `/api/sms/recovery/${syncLog.id}/sync-status?meterNumber=${fixture.meterNumber}`,
      {
        method: "POST",
        headers: staffSession.headers,
      },
    );
    assert.equal(scopedSync.status, 200);

    const adminRetry = await app.request(
      `/api/sms/recovery/${retryLog.id}/retry`,
      {
        method: "POST",
        headers: adminSession.headers,
      },
    );
    assert.equal(adminRetry.status, 200);
  });
});
