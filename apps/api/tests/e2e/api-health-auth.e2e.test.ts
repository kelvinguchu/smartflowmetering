import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app";
import {
  createAuthenticatedSession,
  ensureTestMeterFixture,
  ensureInfraReady,
  teardownE2E,
  uniqueRef,
} from "./helpers";

const app = createApp();
type JsonScalar = string | number | boolean | null;
type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = Record<string, JsonValue>;
const INVALID_PASSWORD = ["bad", "password"].join("-");

async function getJson(path: string, headers?: Record<string, string>) {
  const response = await app.request(path, { method: "GET", headers });
  const text = await response.text();
  let body = {} as JsonObject;
  if (text) {
    try {
      body = JSON.parse(text) as JsonObject;
    } catch {
      body = { raw: text };
    }
  }
  return { response, body };
}

function createApplicationPayload(): JsonObject {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
  return {
    firstName: "Test",
    lastName: "Applicant",
    phoneNumber: `2547${suffix.slice(-8)}`,
    email: `application-${suffix}@example.com`,
    idNumber: `ID${suffix}`,
    kraPin: `KRA${suffix}`,
    county: "Nairobi",
    location: "Westlands",
    buildingType: "residential",
    utilityType: "electricity",
    motherMeterNumber: `MM-${suffix}`,
    initialReading: 0,
    paymentMode: "prepaid",
    subMeterNumbers: [`SM-${suffix}`],
    installationType: "new",
    suppliesOtherHouses: false,
    billPayer: "landlord",
    technicianName: "Field Tech",
    technicianPhone: "254712345678",
    termsAccepted: true,
  };
}

void describe("E2E: API health and auth guards", () => {
  before(async () => {
    await ensureInfraReady();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("returns healthy status on basic health endpoint", async () => {
    const { response, body } = await getJson("/api/health");
    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(body.service, "smartflowmetering-api");
  });

  void it("rejects unauthenticated access to detailed health endpoints", async () => {
    const protectedHealthPaths = [
      "/api/health/detailed",
      "/api/health/queues",
      "/api/mpesa/health",
    ];

    for (const path of protectedHealthPaths) {
      const { response, body } = await getJson(path);
      assert.equal(response.status, 401, `Expected 401 for GET ${path}`);
      assert.equal(body.error, "Unauthorized");
    }
  });

  void it("allows admins to access detailed diagnostics", async () => {
    const adminSession = await createAuthenticatedSession(app, "admin");

    const { response, body } = await getJson(
      "/api/health/detailed",
      adminSession.headers,
    );
    assert.equal(response.status, 200);
    assert.ok(body.checks);
    const checks = body.checks as Record<string, { status: string }>;
    assert.equal(checks.database.status, "ok");
    assert.equal(checks.queues.status, "ok");

    const queueHealth = await getJson(
      "/api/health/queues",
      adminSession.headers,
    );
    assert.equal(queueHealth.response.status, 200);
    assert.equal(queueHealth.body.status, "ok");

    const mpesaHealth = await getJson(
      "/api/mpesa/health",
      adminSession.headers,
    );
    assert.equal(mpesaHealth.response.status, 200);
    assert.equal(mpesaHealth.body.status, "ok");
  });

  void it("forbids non-admin staff from accessing admin diagnostics", async () => {
    const userSession = await createAuthenticatedSession(app, "user");

    const protectedHealthPaths = [
      "/api/health/detailed",
      "/api/health/queues",
      "/api/mpesa/health",
    ];

    for (const path of protectedHealthPaths) {
      const { response, body } = await getJson(path, userSession.headers);
      assert.equal(response.status, 403, `Expected 403 for GET ${path}`);
      assert.equal(body.error, "Forbidden");
    }
  });

  void it("allows staff to review applications but keeps approvals admin-only", async () => {
    const userSession = await createAuthenticatedSession(app, "user");
    const adminSession = await createAuthenticatedSession(app, "admin");
    const fixture = await ensureTestMeterFixture();

    const createResponse = await app.request("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createApplicationPayload()),
    });
    assert.equal(createResponse.status, 201);
    const createdBody = (await createResponse.json()) as {
      data: { id: string };
    };

    const listResponse = await getJson(
      "/api/applications",
      userSession.headers,
    );
    assert.equal(listResponse.response.status, 200);
    assert.ok(Array.isArray(listResponse.body.data));
    const [supportListItem] = listResponse.body.data as Record<
      string,
      JsonValue
    >[];
    assert.ok(supportListItem);
    assert.equal("idNumber" in supportListItem, false);
    assert.equal("kraPin" in supportListItem, false);

    const nonPendingListResponse = await getJson(
      "/api/applications?status=approved",
      userSession.headers,
    );
    assert.equal(nonPendingListResponse.response.status, 403);

    const detailResponse = await getJson(
      `/api/applications/${createdBody.data.id}`,
      userSession.headers,
    );
    assert.equal(detailResponse.response.status, 200);
    assert.equal(
      "idNumber" in (detailResponse.body.data as Record<string, JsonValue>),
      false,
    );
    assert.equal(
      "kraPin" in (detailResponse.body.data as Record<string, JsonValue>),
      false,
    );

    const approveResponse = await app.request(
      `/api/applications/${createdBody.data.id}/approve`,
      {
        method: "POST",
        headers: adminSession.headers,
        body: JSON.stringify({
          tariffId: fixture.tariffId,
        }),
      },
    );
    assert.equal(approveResponse.status, 200);

    const supportApprovedDetailResponse = await getJson(
      `/api/applications/${createdBody.data.id}`,
      userSession.headers,
    );
    assert.equal(supportApprovedDetailResponse.response.status, 404);

    const adminDetailResponse = await getJson(
      `/api/applications/${createdBody.data.id}`,
      adminSession.headers,
    );
    assert.equal(adminDetailResponse.response.status, 200);
    assert.equal(
      "idNumber" in
        (adminDetailResponse.body.data as Record<string, JsonValue>),
      true,
    );
    assert.equal(
      "kraPin" in (adminDetailResponse.body.data as Record<string, JsonValue>),
      true,
    );
  });

  void it("keeps meter mutations admin-only", async () => {
    const fixture = await ensureTestMeterFixture();
    const userSession = await createAuthenticatedSession(app, "user");
    const adminSession = await createAuthenticatedSession(app, "admin");
    const meterNumber = `M${uniqueRef("RBAC").slice(-11)}`;

    const createPayload = {
      meterNumber,
      meterType: "electricity",
      brand: "hexing",
      motherMeterId: fixture.motherMeterId,
      tariffId: fixture.tariffId,
      supplyGroupCode: "600675",
      keyRevisionNumber: 1,
      tariffIndex: 1,
    };

    const userCreateResponse = await app.request("/api/meters", {
      method: "POST",
      headers: userSession.headers,
      body: JSON.stringify(createPayload),
    });
    assert.equal(userCreateResponse.status, 403);

    const adminCreateResponse = await app.request("/api/meters", {
      method: "POST",
      headers: adminSession.headers,
      body: JSON.stringify(createPayload),
    });
    assert.equal(adminCreateResponse.status, 201);
    const adminCreateBody = (await adminCreateResponse.json()) as {
      data: { id: string };
    };

    const userPatchResponse = await app.request(
      `/api/meters/${adminCreateBody.data.id}`,
      {
        method: "PATCH",
        headers: userSession.headers,
        body: JSON.stringify({ supplyGroupCode: "600676" }),
      },
    );
    assert.equal(userPatchResponse.status, 403);

    const adminPatchResponse = await app.request(
      `/api/meters/${adminCreateBody.data.id}`,
      {
        method: "PATCH",
        headers: adminSession.headers,
        body: JSON.stringify({ supplyGroupCode: "600676" }),
      },
    );
    assert.equal(adminPatchResponse.status, 200);
  });

  void it("applies the auth-specific rate limit to auth routes", async () => {
    let lastStatus = 0;
    const headers = {
      "Content-Type": "application/json",
      "x-forwarded-for": "198.51.100.44",
    };

    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await app.request("/api/auth/sign-in/email", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: "missing-user@example.com",
          password: INVALID_PASSWORD,
        }),
      });
      lastStatus = response.status;
    }

    assert.equal(lastStatus, 429);
  });

  void it("scopes auth rate limiting per client IP", async () => {
    const exhaustedHeaders = {
      "Content-Type": "application/json",
      "x-forwarded-for": "198.51.100.54",
    };

    for (let attempt = 0; attempt < 11; attempt += 1) {
      await app.request("/api/auth/sign-in/email", {
        method: "POST",
        headers: exhaustedHeaders,
        body: JSON.stringify({
          email: "missing-user@example.com",
          password: INVALID_PASSWORD,
        }),
      });
    }

    const isolatedClientResponse = await app.request(
      "/api/auth/sign-in/email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "198.51.100.55",
        },
        body: JSON.stringify({
          email: "missing-user@example.com",
          password: INVALID_PASSWORD,
        }),
      },
    );

    assert.notEqual(isolatedClientResponse.status, 429);
  });

  void it("rejects unauthenticated access for protected route groups", async () => {
    const protectedCalls: {
      method: "GET" | "POST";
      path: string;
      payload?: JsonObject;
    }[] = [
      { method: "GET", path: "/api/meters" },
      { method: "GET", path: "/api/tariffs" },
      { method: "GET", path: "/api/transactions" },
      { method: "GET", path: "/api/sms" },
      { method: "GET", path: "/api/notifications" },
      { method: "GET", path: "/api/failed-transactions" },
      { method: "GET", path: "/api/gomelong/health" },
      { method: "GET", path: "/api/applications" },
      { method: "GET", path: "/api/mother-meters" },
      { method: "GET", path: "/api/mother-meters/alerts/low-balance" },
      { method: "GET", path: "/api/mother-meters/alerts/postpaid-reminders" },
      {
        method: "POST",
        path: "/api/applications/00000000-0000-0000-0000-000000000000/approve",
        payload: {
          tariffId: "00000000-0000-0000-0000-000000000000",
        } as JsonObject,
      },
      {
        method: "POST",
        path: "/api/mother-meters/alerts/low-balance/notify",
        payload: {} as JsonObject,
      },
      {
        method: "POST",
        path: "/api/mother-meters/alerts/postpaid-reminders/notify",
        payload: {} as JsonObject,
      },
      {
        method: "POST",
        path: "/api/notifications/run-alert-checks",
        payload: {} as JsonObject,
      },
      {
        method: "POST",
        path: "/api/notifications/run-daily-usage-sms",
        payload: {} as JsonObject,
      },
      {
        method: "POST",
        path: "/api/mother-meters/00000000-0000-0000-0000-000000000000/events",
        payload: { eventType: "refill", amount: 1000 } as JsonObject,
      },
      {
        method: "POST",
        path: "/api/mpesa/stk-push",
        payload: {
          phoneNumber: "254712345678",
          amount: 100,
          meterNumber: "TEST-METER-001",
        } as JsonObject,
      },
    ];

    for (const call of protectedCalls) {
      const response = await app.request(call.path, {
        method: call.method,
        headers: call.payload
          ? { "Content-Type": "application/json" }
          : undefined,
        body: call.payload ? JSON.stringify(call.payload) : undefined,
      });

      assert.equal(
        response.status,
        401,
        `Expected 401 for ${call.method} ${call.path}, got ${response.status}`,
      );
    }
  });
});
