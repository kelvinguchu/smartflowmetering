import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app";
import {
  createAuthenticatedSession,
  ensureInfraReady,
  teardownE2E,
} from "./helpers";

const app = createApp();

async function getJson(path: string, headers?: Record<string, string>) {
  const response = await app.request(path, { method: "GET", headers });
  const text = await response.text();
  const body = text ? tryParseJson(text) : {};
  return { body, response };
}

function tryParseJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return { raw: value };
  }
}

void describe("E2E: SMS auth guards", () => {
  before(async () => {
    await ensureInfraReady();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("keeps broad sms log access and provider health admin-only", async () => {
    const userSession = await createAuthenticatedSession(app, "user");
    const adminSession = await createAuthenticatedSession(app, "admin");

    const smsList = await getJson("/api/sms", userSession.headers);
    assert.equal(smsList.response.status, 403);

    const smsHealth = await getJson("/api/sms/provider-health", userSession.headers);
    assert.equal(smsHealth.response.status, 403);

    const adminSmsList = await getJson("/api/sms", adminSession.headers);
    assert.equal(adminSmsList.response.status, 200);
    assert.ok(Array.isArray(adminSmsList.body.data));

    const adminSmsHealth = await getJson("/api/sms/provider-health", adminSession.headers);
    assert.equal(adminSmsHealth.response.status, 200);

    const smsTestResponse = await app.request("/api/sms/test", {
      method: "POST",
      headers: userSession.headers,
      body: JSON.stringify({
        message: "Test SMS",
        phoneNumber: "254712345678",
      }),
    });
    assert.equal(smsTestResponse.status, 403);
  });
});
