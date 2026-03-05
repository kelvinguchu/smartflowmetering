import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { ensureInfraReady, teardownE2E } from "./helpers";

const app = createApp();

async function getJson(path: string) {
  const response = await app.request(path, { method: "GET" });
  const body = (await response.json()) as Record<string, unknown>;
  return { response, body };
}

describe("E2E: API health and auth guards", () => {
  before(async () => {
    await ensureInfraReady();
  });

  after(async () => {
    await teardownE2E();
  });

  it("returns healthy status on basic health endpoint", async () => {
    const { response, body } = await getJson("/api/health");
    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(body.service, "smartflowmetering-api");
  });

  it("returns detailed health with database and queue checks", async () => {
    const { response, body } = await getJson("/api/health/detailed");
    assert.equal(response.status, 200);
    assert.ok(body.checks);
    assert.equal(
      (body.checks as Record<string, { status?: string }>).database?.status,
      "ok"
    );
    assert.equal(
      (body.checks as Record<string, { status?: string }>).queues?.status,
      "ok"
    );
  });

  it("rejects unauthenticated access for protected route groups", async () => {
    const protectedCalls: Array<{
      method: "GET" | "POST";
      path: string;
      payload?: Record<string, unknown>;
    }> = [
      { method: "GET", path: "/api/meters" },
      { method: "GET", path: "/api/tariffs" },
      { method: "GET", path: "/api/transactions" },
      { method: "GET", path: "/api/sms" },
      { method: "GET", path: "/api/gomelong/health" },
      { method: "GET", path: "/api/applications" },
      {
        method: "POST",
        path: "/api/applications/00000000-0000-0000-0000-000000000000/approve",
        payload: { tariffId: "00000000-0000-0000-0000-000000000000" },
      },
      {
        method: "POST",
        path: "/api/mpesa/stk-push",
        payload: {
          phoneNumber: "254712345678",
          amount: 100,
          meterNumber: "TEST-METER-001",
        },
      },
    ];

    for (const call of protectedCalls) {
      const response = await app.request(call.path, {
        method: call.method,
        headers: call.payload ? { "Content-Type": "application/json" } : undefined,
        body: call.payload ? JSON.stringify(call.payload) : undefined,
      });

      assert.equal(
        response.status,
        401,
        `Expected 401 for ${call.method} ${call.path}, got ${response.status}`
      );
    }
  });
});
