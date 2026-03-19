import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { env } from "../../src/config";
import {
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
  uniqueRef,
} from "./helpers";

const app = createApp();

const basePayload = {
  TransactionType: "Pay Bill",
  TransTime: "20260305120000",
  BusinessShortCode: "174379",
  BillRefNumber: "TEST-METER-SIGN",
  MSISDN: "254712345678",
  FirstName: "Sig",
  MiddleName: "Na",
  LastName: "Ture",
};

type MutableEnv = {
  MPESA_ALLOWED_IPS: string[];
  MPESA_CALLBACK_TOKEN: string;
  MPESA_CALLBACK_TOKEN_TRANSPORT: "header" | "query" | "query_or_header";
  MPESA_REQUIRE_SIGNATURE: boolean;
  NODE_ENV: "development" | "production" | "test";
  MPESA_SIGNATURE_SECRET: string;
  MPESA_SIGNATURE_HEADER: string;
  MPESA_SIGNATURE_TIMESTAMP_HEADER: string;
  MPESA_SIGNATURE_MAX_AGE_SECONDS: number;
};

function signPayload(
  secret: string,
  timestamp: string,
  rawBody: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

describe("E2E: M-Pesa signature validation", () => {
  const originalEnv = {
    MPESA_ALLOWED_IPS: [...env.MPESA_ALLOWED_IPS],
    MPESA_CALLBACK_TOKEN: env.MPESA_CALLBACK_TOKEN,
    MPESA_CALLBACK_TOKEN_TRANSPORT: env.MPESA_CALLBACK_TOKEN_TRANSPORT,
    MPESA_REQUIRE_SIGNATURE: env.MPESA_REQUIRE_SIGNATURE,
    NODE_ENV: env.NODE_ENV,
    MPESA_SIGNATURE_SECRET: env.MPESA_SIGNATURE_SECRET,
    MPESA_SIGNATURE_HEADER: env.MPESA_SIGNATURE_HEADER,
    MPESA_SIGNATURE_TIMESTAMP_HEADER: env.MPESA_SIGNATURE_TIMESTAMP_HEADER,
    MPESA_SIGNATURE_MAX_AGE_SECONDS: env.MPESA_SIGNATURE_MAX_AGE_SECONDS,
  } satisfies MutableEnv;

  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
    await ensureTestMeterFixture("TEST-METER-SIGN");

    Object.assign(env as MutableEnv, {
      MPESA_ALLOWED_IPS: [],
      MPESA_CALLBACK_TOKEN: "",
      MPESA_CALLBACK_TOKEN_TRANSPORT: "header",
      MPESA_REQUIRE_SIGNATURE: true,
      NODE_ENV: "test",
      MPESA_SIGNATURE_SECRET: "e2e-signature-secret",
      MPESA_SIGNATURE_HEADER: "x-mpesa-signature",
      MPESA_SIGNATURE_TIMESTAMP_HEADER: "x-mpesa-timestamp",
      MPESA_SIGNATURE_MAX_AGE_SECONDS: 300,
    });
  });

  after(async () => {
    Object.assign(env as MutableEnv, originalEnv);
    await teardownE2E();
  });

  it("accepts validation request with a correct signature", async () => {
    const payload = {
      ...basePayload,
      TransID: uniqueRef("SIG-VALID-"),
      TransAmount: 100,
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signPayload(
      env.MPESA_SIGNATURE_SECRET,
      timestamp,
      rawBody,
    );

    const response = await app.request("/api/mpesa/validation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "196.201.214.200",
        [env.MPESA_SIGNATURE_HEADER]: signature,
        [env.MPESA_SIGNATURE_TIMESTAMP_HEADER]: timestamp,
      },
      body: rawBody,
    });
    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.equal(body.ResultCode, "0");
  });

  it("rejects validation request with invalid signature", async () => {
    const payload = {
      ...basePayload,
      TransID: uniqueRef("SIG-INVALID-"),
      TransAmount: 100,
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const response = await app.request("/api/mpesa/validation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "196.201.214.200",
        [env.MPESA_SIGNATURE_HEADER]: "deadbeef",
        [env.MPESA_SIGNATURE_TIMESTAMP_HEADER]: timestamp,
      },
      body: rawBody,
    });
    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 403);
    assert.equal(body.ResultCode, "C2B00016");
  });

  it("rejects validation request with stale signature timestamp", async () => {
    const payload = {
      ...basePayload,
      TransID: uniqueRef("SIG-STALE-"),
      TransAmount: 100,
    };
    const rawBody = JSON.stringify(payload);
    const staleTimestamp = Math.floor(
      (Date.now() - 10 * 60 * 1000) / 1000,
    ).toString();
    const signature = signPayload(
      env.MPESA_SIGNATURE_SECRET,
      staleTimestamp,
      rawBody,
    );

    const response = await app.request("/api/mpesa/validation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "196.201.214.200",
        [env.MPESA_SIGNATURE_HEADER]: signature,
        [env.MPESA_SIGNATURE_TIMESTAMP_HEADER]: staleTimestamp,
      },
      body: rawBody,
    });
    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 403);
    assert.equal(body.ResultCode, "C2B00016");
  });

  it("rejects callback requests that use the wrong callback token transport in production mode", async () => {
    const payload = {
      ...basePayload,
      TransID: uniqueRef("SIG-TOKEN-"),
      TransAmount: 100,
    };
    const rawBody = JSON.stringify(payload);

    Object.assign(env as MutableEnv, {
      MPESA_ALLOWED_IPS: ["196.201.214."],
      MPESA_CALLBACK_TOKEN: "production-callback-token",
      MPESA_CALLBACK_TOKEN_TRANSPORT: "header",
      MPESA_REQUIRE_SIGNATURE: false,
      NODE_ENV: "production",
      MPESA_SIGNATURE_SECRET: "",
    });

    const response = await app.request(
      "/api/mpesa/validation?callback_token=production-callback-token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "196.201.214.200",
        },
        body: rawBody,
      },
    );
    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 403);
    assert.equal(body.ResultCode, "C2B00016");
  });

  it("rejects callback requests from non-Safaricom source IPs in production mode", async () => {
    const payload = {
      ...basePayload,
      TransID: uniqueRef("SIG-IP-"),
      TransAmount: 100,
    };
    const rawBody = JSON.stringify(payload);

    Object.assign(env as MutableEnv, {
      MPESA_ALLOWED_IPS: ["196.201.214."],
      MPESA_CALLBACK_TOKEN: "production-callback-token",
      MPESA_CALLBACK_TOKEN_TRANSPORT: "header",
      MPESA_REQUIRE_SIGNATURE: false,
      NODE_ENV: "production",
      MPESA_SIGNATURE_SECRET: "",
    });

    const response = await app.request("/api/mpesa/validation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.10",
        "x-mpesa-callback-token": "production-callback-token",
      },
      body: rawBody,
    });
    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 403);
    assert.equal(body.ResultCode, "C2B00016");
  });

  it("accepts callback requests with a valid header token and Safaricom source IP in production mode", async () => {
    const payload = {
      ...basePayload,
      TransID: uniqueRef("SIG-PROD-"),
      TransAmount: 100,
    };
    const rawBody = JSON.stringify(payload);

    Object.assign(env as MutableEnv, {
      MPESA_ALLOWED_IPS: ["196.201.214."],
      MPESA_CALLBACK_TOKEN: "production-callback-token",
      MPESA_CALLBACK_TOKEN_TRANSPORT: "header",
      MPESA_REQUIRE_SIGNATURE: false,
      NODE_ENV: "production",
      MPESA_SIGNATURE_SECRET: "",
    });

    const response = await app.request("/api/mpesa/validation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "196.201.214.200",
        "x-mpesa-callback-token": "production-callback-token",
      },
      body: rawBody,
    });
    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.equal(body.ResultCode, "0");
  });
});
