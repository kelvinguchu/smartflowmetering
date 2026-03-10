import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { createApp } from "../../src/app";
import { env } from "../../src/config";
import { db } from "../../src/db";
import { generatedTokens, transactions } from "../../src/db/schema";
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
  GOMELONG_BRANDS: string[];
  GOMELONG_VENDING_TYPE: 0 | 1;
  HEXING_API_URL: string;
  HEXING_API_KEY: string;
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
  handler: (req: IncomingMessage, res: ServerResponse) => void
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
        server.close((error) => (error ? reject(error) : resolve()))
      );
    },
  };
}

describe("E2E: Gomelong vending integration", () => {
  const originalAllowMockFallback = process.env.ALLOW_MOCK_TOKEN_FALLBACK;
  const originalEnv = {
    GOMELONG_API_URL: env.GOMELONG_API_URL,
    GOMELONG_USER_ID: env.GOMELONG_USER_ID,
    GOMELONG_PASSWORD: env.GOMELONG_PASSWORD,
    GOMELONG_BRANDS: [...env.GOMELONG_BRANDS],
    GOMELONG_VENDING_TYPE: env.GOMELONG_VENDING_TYPE,
    HEXING_API_URL: env.HEXING_API_URL,
    HEXING_API_KEY: env.HEXING_API_KEY,
  } satisfies MutableEnv;

  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
    await ensureTestMeterFixture("TEST-METER-GOMELONG");
    process.env.ALLOW_MOCK_TOKEN_FALLBACK = "false";
  });

  after(async () => {
    Object.assign(env as MutableEnv, originalEnv);
    process.env.GOMELONG_API_URL = originalEnv.GOMELONG_API_URL;
    process.env.GOMELONG_USER_ID = originalEnv.GOMELONG_USER_ID;
    process.env.GOMELONG_PASSWORD = originalEnv.GOMELONG_PASSWORD;
    if (originalAllowMockFallback == null) {
      delete process.env.ALLOW_MOCK_TOKEN_FALLBACK;
    } else {
      process.env.ALLOW_MOCK_TOKEN_FALLBACK = originalAllowMockFallback;
    }
    await teardownE2E();
  });

  it("generates token successfully via Gomelong provider", async () => {
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
          })
        );
        return;
      }

      res.writeHead(404);
      res.end();
    });

    Object.assign(env as MutableEnv, {
      GOMELONG_API_URL: server.url,
      GOMELONG_USER_ID: "gomelong-user",
      GOMELONG_PASSWORD: "gomelong-pass",
      GOMELONG_BRANDS: [],
      GOMELONG_VENDING_TYPE: 1,
      HEXING_API_URL: "http://127.0.0.1:1",
      HEXING_API_KEY: "force-live-provider",
    });
    process.env.GOMELONG_API_URL = server.url;
    process.env.GOMELONG_USER_ID = "gomelong-user";
    process.env.GOMELONG_PASSWORD = "gomelong-pass";

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
    });

    const [tokenRow] = await db
      .select({ token: generatedTokens.token })
      .from(generatedTokens)
      .innerJoin(transactions, eq(generatedTokens.transactionId, transactions.id))
      .where(eq(transactions.mpesaReceiptNumber, receipt))
      .limit(1);

    assert.ok(tokenRow);
    assert.match(tokenRow.token, /^\d{20}$/);

    await server.close();
  });

  it("marks transaction failed when Gomelong vending keeps failing", async () => {
    const server = await withMockGomelongServer((req, res) => {
      if (req.url?.startsWith("/api/Power/GetVendingToken")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            code: 9001,
            message: "provider unavailable",
            data: null,
          })
        );
        return;
      }

      res.writeHead(404);
      res.end();
    });

    Object.assign(env as MutableEnv, {
      GOMELONG_API_URL: server.url,
      GOMELONG_USER_ID: "gomelong-user",
      GOMELONG_PASSWORD: "gomelong-pass",
      GOMELONG_BRANDS: [],
      GOMELONG_VENDING_TYPE: 1,
      HEXING_API_URL: "http://127.0.0.1:1",
      HEXING_API_KEY: "force-live-provider",
    });
    process.env.GOMELONG_API_URL = server.url;
    process.env.GOMELONG_USER_ID = "gomelong-user";
    process.env.GOMELONG_PASSWORD = "gomelong-pass";

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

    await server.close();
  });

  it("retries token generation and succeeds after transient Gomelong failures", async () => {
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
            })
          );
          return;
        }

        res.end(
          JSON.stringify({
            code: 0,
            message: "ok",
            data: { token: "55556666777788889999" },
          })
        );
        return;
      }

      res.writeHead(404);
      res.end();
    });

    Object.assign(env as MutableEnv, {
      GOMELONG_API_URL: server.url,
      GOMELONG_USER_ID: "gomelong-user",
      GOMELONG_PASSWORD: "gomelong-pass",
      GOMELONG_BRANDS: [],
      GOMELONG_VENDING_TYPE: 1,
      HEXING_API_URL: "http://127.0.0.1:1",
      HEXING_API_KEY: "force-live-provider",
    });
    process.env.GOMELONG_API_URL = server.url;
    process.env.GOMELONG_USER_ID = "gomelong-user";
    process.env.GOMELONG_PASSWORD = "gomelong-pass";

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

    assert.ok(providerCalls >= 1);

    const [tokenRow] = await db
      .select({ token: generatedTokens.token })
      .from(generatedTokens)
      .innerJoin(transactions, eq(generatedTokens.transactionId, transactions.id))
      .where(eq(transactions.mpesaReceiptNumber, receipt))
      .limit(1);

    assert.ok(tokenRow);
    assert.match(tokenRow.token, /^\d{20}$/);

    await server.close();
  });
});
