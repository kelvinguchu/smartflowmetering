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
  MPESA_REQUIRE_SIGNATURE: boolean;
  MPESA_SIGNATURE_SECRET: string;
  MPESA_SIGNATURE_HEADER: string;
  MPESA_SIGNATURE_TIMESTAMP_HEADER: string;
  MPESA_SIGNATURE_MAX_AGE_SECONDS: number;
};

function signPayload(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

describe("E2E: M-Pesa signature validation", () => {
  const originalEnv = {
    MPESA_REQUIRE_SIGNATURE: env.MPESA_REQUIRE_SIGNATURE,
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
      MPESA_REQUIRE_SIGNATURE: true,
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
      rawBody
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
    const staleTimestamp = Math.floor((Date.now() - 10 * 60 * 1000) / 1000).toString();
    const signature = signPayload(
      env.MPESA_SIGNATURE_SECRET,
      staleTimestamp,
      rawBody
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
});
