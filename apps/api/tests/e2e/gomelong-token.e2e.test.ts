import assert from "node:assert/strict";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { createApp } from "../../src/app";
import { env } from "../../src/config";
import { db } from "../../src/db";
import {
  failedTransactions,
  generatedTokens,
  transactions,
} from "../../src/db/schema";
import { isProtectedToken, revealToken } from "../../src/lib/token-protection";
import {
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
  uniqueRef,
  waitFor,
} from "./helpers";

const app = createApp();

type MutableEnv = {
  GOMELONG_API_URL: string;
  GOMELONG_USER_ID: string;
  GOMELONG_PASSWORD: string;
  GOMELONG_VENDING_TYPE: 0 | 1;
};

function postCallback(payload: Record<string, unknown>) {
  return app.request("/api/mpesa/callback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "196.201.214.200",
    },
    body: JSON.stringify(payload),
  });
}

async function withMockGomelongServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

function configureMockProviderEnv(url: string) {
  const mockProviderPassword = uniqueRef("gomelong-secret-");

  Object.assign(env as MutableEnv, {
    GOMELONG_API_URL: url,
    GOMELONG_USER_ID: "gomelong-user",
    GOMELONG_PASSWORD: mockProviderPassword,
    GOMELONG_VENDING_TYPE: 1,
  });
  process.env.GOMELONG_API_URL = url;
  process.env.GOMELONG_USER_ID = "gomelong-user";
  process.env.GOMELONG_PASSWORD = mockProviderPassword;
}

void describe(
  "E2E: Gomelong vending integration",
  {
    concurrency: false,
    skip: "Temporarily skipped while local queue/env race is being fixed",
  },
  () => {
    const originalEnv = {
      GOMELONG_API_URL: env.GOMELONG_API_URL,
      GOMELONG_USER_ID: env.GOMELONG_USER_ID,
      GOMELONG_PASSWORD: env.GOMELONG_PASSWORD,
      GOMELONG_VENDING_TYPE: env.GOMELONG_VENDING_TYPE,
    } satisfies MutableEnv;

    before(async () => {
      await ensureInfraReady();
    });

    beforeEach(async () => {
      await resetE2EState();
      await ensureTestMeterFixture("TEST-METER-GOMELONG");
    });

    after(async () => {
      Object.assign(env as MutableEnv, originalEnv);
      process.env.GOMELONG_API_URL = originalEnv.GOMELONG_API_URL;
      process.env.GOMELONG_USER_ID = originalEnv.GOMELONG_USER_ID;
      process.env.GOMELONG_PASSWORD = originalEnv.GOMELONG_PASSWORD;
      await teardownE2E();
    });

    void it("generates token successfully via Gomelong provider", async () => {
      let providerCalls = 0;
      const server = await withMockGomelongServer((req, res) => {
        if (req.url?.startsWith("/api/Power/GetVendingToken")) {
          providerCalls += 1;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              code: 0,
              message: "ok",
              data: { token: "12345678901234567890" },
            }),
          );
          return;
        }

        res.writeHead(404);
        res.end();
      });

      configureMockProviderEnv(server.url);

      const receipt = uniqueRef("GOME-SUCCESS-");
      const callback = await postCallback({
        TransactionType: "Pay Bill",
        TransID: receipt,
        TransTime: "20260305120000",
        TransAmount: 100,
        BusinessShortCode: "174379",
        BillRefNumber: "TEST-METER-GOMELONG",
        MSISDN: "254712345678",
        FirstName: "Gome",
        MiddleName: "Long",
        LastName: "Success",
      });
      assert.equal(callback.status, 200);

      await waitFor(async () => {
        const tx = await db.query.transactions.findFirst({
          where: eq(transactions.mpesaReceiptNumber, receipt),
          columns: { status: true },
        });
        return tx?.status === "completed";
      }, 30_000);

      const [tokenRow] = await db
        .select({ token: generatedTokens.token })
        .from(generatedTokens)
        .innerJoin(
          transactions,
          eq(generatedTokens.transactionId, transactions.id),
        )
        .where(eq(transactions.mpesaReceiptNumber, receipt))
        .limit(1);

      assert.ok(tokenRow);
      assert.equal(isProtectedToken(tokenRow.token), true);
      assert.match(revealToken(tokenRow.token), /^\d{20}$/);
      assert.equal(providerCalls, 1);

      await server.close();
    });

    void it("marks transaction failed when Gomelong vending keeps failing", async () => {
      const server = await withMockGomelongServer((req, res) => {
        if (req.url?.startsWith("/api/Power/GetVendingToken")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              code: 9001,
              message: "provider unavailable",
              data: null,
            }),
          );
          return;
        }

        res.writeHead(404);
        res.end();
      });

      configureMockProviderEnv(server.url);

      const receipt = uniqueRef("GOME-FAIL-");
      const callback = await postCallback({
        TransactionType: "Pay Bill",
        TransID: receipt,
        TransTime: "20260305120000",
        TransAmount: 100,
        BusinessShortCode: "174379",
        BillRefNumber: "TEST-METER-GOMELONG",
        MSISDN: "254712345678",
        FirstName: "Gome",
        MiddleName: "Long",
        LastName: "Fail",
      });
      assert.equal(callback.status, 200);

      await waitFor(async () => {
        const tx = await db.query.transactions.findFirst({
          where: eq(transactions.mpesaReceiptNumber, receipt),
          columns: { status: true },
        });
        return tx?.status === "failed";
      }, 20_000);

      const failedTx = await db.query.transactions.findFirst({
        where: eq(transactions.mpesaReceiptNumber, receipt),
        columns: { id: true, status: true },
      });
      assert.ok(failedTx);
      assert.equal(failedTx.status, "failed");

      const tokens = await db
        .select({ id: generatedTokens.id })
        .from(generatedTokens)
        .where(eq(generatedTokens.transactionId, failedTx.id));
      assert.equal(tokens.length, 0);

      await waitFor(async () => {
        const [review] = await db
          .select({ id: failedTransactions.id })
          .from(failedTransactions)
          .innerJoin(
            transactions,
            eq(
              failedTransactions.mpesaTransactionId,
              transactions.mpesaTransactionId,
            ),
          )
          .where(eq(transactions.mpesaReceiptNumber, receipt))
          .limit(1);

        return Boolean(review);
      }, 20_000);

      const [failedReview] = await db
        .select({
          failureDetails: failedTransactions.failureDetails,
          failureReason: failedTransactions.failureReason,
        })
        .from(failedTransactions)
        .innerJoin(
          transactions,
          eq(
            failedTransactions.mpesaTransactionId,
            transactions.mpesaTransactionId,
          ),
        )
        .where(eq(transactions.mpesaReceiptNumber, receipt))
        .limit(1);

      assert.ok(failedReview);
      assert.equal(failedReview.failureReason, "manufacturer_error");
      assert.match(
        failedReview.failureDetails ?? "",
        /category=transient_provider_failure/,
      );
      assert.match(
        failedReview.failureDetails ?? "",
        /disposition=retryable_retries_exhausted/,
      );

      await server.close();
    });

    void it("does not retry non-retryable Gomelong meter failures", async () => {
      const server = await withMockGomelongServer((req, res) => {
        if (req.url?.startsWith("/api/Power/GetVendingToken")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              code: 4004,
              message: "invalid meter number",
              data: null,
            }),
          );
          return;
        }

        res.writeHead(404);
        res.end();
      });

      configureMockProviderEnv(server.url);

      const receipt = uniqueRef("GOME-INVALID-");
      const callback = await postCallback({
        TransactionType: "Pay Bill",
        TransID: receipt,
        TransTime: "20260305120000",
        TransAmount: 100,
        BusinessShortCode: "174379",
        BillRefNumber: "TEST-METER-GOMELONG",
        MSISDN: "254712345678",
        FirstName: "Gome",
        MiddleName: "Long",
        LastName: "Invalid",
      });
      assert.equal(callback.status, 200);

      await waitFor(async () => {
        const tx = await db.query.transactions.findFirst({
          where: eq(transactions.mpesaReceiptNumber, receipt),
          columns: { status: true },
        });
        return tx?.status === "failed";
      }, 20_000);

      await waitFor(async () => {
        const [review] = await db
          .select({ id: failedTransactions.id })
          .from(failedTransactions)
          .innerJoin(
            transactions,
            eq(
              failedTransactions.mpesaTransactionId,
              transactions.mpesaTransactionId,
            ),
          )
          .where(eq(transactions.mpesaReceiptNumber, receipt))
          .limit(1);

        return Boolean(review);
      }, 20_000);

      const [failedReview] = await db
        .select({ failureDetails: failedTransactions.failureDetails })
        .from(failedTransactions)
        .innerJoin(
          transactions,
          eq(
            failedTransactions.mpesaTransactionId,
            transactions.mpesaTransactionId,
          ),
        )
        .where(eq(transactions.mpesaReceiptNumber, receipt))
        .limit(1);

      assert.ok(failedReview);
      assert.match(
        failedReview.failureDetails ?? "",
        /category=invalid_meter_or_contract/,
      );
      assert.match(
        failedReview.failureDetails ?? "",
        /disposition=non_retryable/,
      );

      await server.close();
    });

    void it("retries token generation and succeeds after transient Gomelong failures", async () => {
      let providerCalls = 0;
      const server = await withMockGomelongServer((req, res) => {
        if (req.url?.startsWith("/api/Power/GetVendingToken")) {
          providerCalls += 1;
          res.writeHead(200, { "Content-Type": "application/json" });
          if (providerCalls < 3) {
            res.end(
              JSON.stringify({
                code: 5002,
                message: `temporary failure #${providerCalls}`,
                data: null,
              }),
            );
            return;
          }

          res.end(
            JSON.stringify({
              code: 0,
              message: "ok",
              data: { token: "55556666777788889999" },
            }),
          );
          return;
        }

        res.writeHead(404);
        res.end();
      });

      configureMockProviderEnv(server.url);

      const receipt = uniqueRef("GOME-RETRY-");
      const callback = await postCallback({
        TransactionType: "Pay Bill",
        TransID: receipt,
        TransTime: "20260305120000",
        TransAmount: 100,
        BusinessShortCode: "174379",
        BillRefNumber: "TEST-METER-GOMELONG",
        MSISDN: "254712345678",
        FirstName: "Gome",
        MiddleName: "Long",
        LastName: "Retry",
      });
      assert.equal(callback.status, 200);

      await waitFor(async () => {
        const tx = await db.query.transactions.findFirst({
          where: eq(transactions.mpesaReceiptNumber, receipt),
          columns: { status: true },
        });
        return tx?.status === "completed";
      }, 20_000);

      assert.equal(providerCalls, 3);

      const [tokenRow] = await db
        .select({ token: generatedTokens.token })
        .from(generatedTokens)
        .innerJoin(
          transactions,
          eq(generatedTokens.transactionId, transactions.id),
        )
        .where(eq(transactions.mpesaReceiptNumber, receipt))
        .limit(1);

      assert.ok(tokenRow);
      assert.equal(isProtectedToken(tokenRow.token), true);
      assert.match(revealToken(tokenRow.token), /^\d{20}$/);

      await server.close();
    });
  },
);
