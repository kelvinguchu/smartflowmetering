import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app";
import {
  createAuthenticatedSession,
  ensureInfraReady,
  ensureTestMeterFixture,
  teardownE2E,
} from "./helpers";

const app = createApp();

void describe("E2E: RBAC permission matrix", () => {
  before(async () => {
    await ensureInfraReady();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("allows support staff to read transactions and mother meter data", async () => {
    const fixture = await ensureTestMeterFixture();
    const userSession = await createAuthenticatedSession(app, "user");

    const transactionsResponse = await app.request("/api/transactions", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(transactionsResponse.status, 200);

    const motherMetersResponse = await app.request("/api/mother-meters", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(motherMetersResponse.status, 200);

    const balanceResponse = await app.request(
      `/api/mother-meters/${fixture.motherMeterId}/balance`,
      {
        method: "GET",
        headers: userSession.headers,
      },
    );
    assert.equal(balanceResponse.status, 200);

    const tariffsResponse = await app.request("/api/tariffs", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(tariffsResponse.status, 200);

    const smsResponse = await app.request("/api/sms", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(smsResponse.status, 200);
  });

  void it("keeps admin-only transaction and mother meter actions restricted", async () => {
    const fixture = await ensureTestMeterFixture();
    const userSession = await createAuthenticatedSession(app, "user");
    const adminSession = await createAuthenticatedSession(app, "admin");

    const userSummaryResponse = await app.request("/api/transactions/stats/summary", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(userSummaryResponse.status, 403);

    const userReconciliationResponse = await app.request(
      `/api/mother-meters/${fixture.motherMeterId}/reconciliation`,
      {
        method: "GET",
        headers: userSession.headers,
      },
    );
    assert.equal(userReconciliationResponse.status, 403);

    const userEventResponse = await app.request(
      `/api/mother-meters/${fixture.motherMeterId}/events`,
      {
        method: "POST",
        headers: userSession.headers,
        body: JSON.stringify({
          eventType: "refill",
          amount: 1000,
          kplcReceiptNumber: "KPLC-TEST-001",
        }),
      },
    );
    assert.equal(userEventResponse.status, 403);

    const adminSummaryResponse = await app.request(
      "/api/transactions/stats/summary",
      {
        method: "GET",
        headers: adminSession.headers,
      },
    );
    assert.equal(adminSummaryResponse.status, 200);

    const adminEventResponse = await app.request(
      `/api/mother-meters/${fixture.motherMeterId}/events`,
      {
        method: "POST",
        headers: adminSession.headers,
        body: JSON.stringify({
          eventType: "refill",
          amount: 1000,
          kplcReceiptNumber: "KPLC-TEST-002",
        }),
      },
    );
    assert.equal(adminEventResponse.status, 201);

    const adminReconciliationResponse = await app.request(
      `/api/mother-meters/${fixture.motherMeterId}/reconciliation`,
      {
        method: "GET",
        headers: adminSession.headers,
      },
    );
    assert.equal(adminReconciliationResponse.status, 200);
  });

  void it("keeps admin-only operations routes restricted to admins", async () => {
    const userSession = await createAuthenticatedSession(app, "user");
    const adminSession = await createAuthenticatedSession(app, "admin");

    const userNotificationsResponse = await app.request("/api/notifications", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(userNotificationsResponse.status, 403);

    const userFailedTransactionsResponse = await app.request(
      "/api/failed-transactions",
      {
        method: "GET",
        headers: userSession.headers,
      },
    );
    assert.equal(userFailedTransactionsResponse.status, 403);

    const userGomelongHealthResponse = await app.request("/api/gomelong/health", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(userGomelongHealthResponse.status, 403);

    const userAdminTokenResponse = await app.request("/api/admin-tokens", {
      method: "POST",
      headers: userSession.headers,
      body: JSON.stringify({
        action: "clear_credit",
        meterNumber: "TEST-METER-001",
        reason: "Support test",
        delivery: "none",
      }),
    });
    assert.equal(userAdminTokenResponse.status, 403);

    const userTariffHistoryResponse = await app.request("/api/tariffs/all", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(userTariffHistoryResponse.status, 403);

    const userDiagnosticsResponse = await app.request("/api/health/detailed", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(userDiagnosticsResponse.status, 403);

    const userMpesaHealthResponse = await app.request("/api/mpesa/health", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(userMpesaHealthResponse.status, 403);

    const userMotherMeterAlertsResponse = await app.request(
      "/api/mother-meters/alerts/low-balance",
      {
        method: "GET",
        headers: userSession.headers,
      },
    );
    assert.equal(userMotherMeterAlertsResponse.status, 403);

    const userSmsTestResponse = await app.request("/api/sms/test", {
      method: "POST",
      headers: userSession.headers,
      body: JSON.stringify({
        phoneNumber: "+254700000000",
        message: "Test",
      }),
    });
    assert.equal(userSmsTestResponse.status, 403);

    const adminNotificationsResponse = await app.request("/api/notifications", {
      method: "GET",
      headers: adminSession.headers,
    });
    assert.equal(adminNotificationsResponse.status, 200);

    const adminFailedTransactionsResponse = await app.request(
      "/api/failed-transactions",
      {
        method: "GET",
        headers: adminSession.headers,
      },
    );
    assert.equal(adminFailedTransactionsResponse.status, 200);

    const adminGomelongHealthResponse = await app.request("/api/gomelong/health", {
      method: "GET",
      headers: adminSession.headers,
    });
    assert.equal(adminGomelongHealthResponse.status, 200);

    const adminTariffHistoryResponse = await app.request("/api/tariffs/all", {
      method: "GET",
      headers: adminSession.headers,
    });
    assert.equal(adminTariffHistoryResponse.status, 200);

    const adminDiagnosticsResponse = await app.request("/api/health/detailed", {
      method: "GET",
      headers: adminSession.headers,
    });
    assert.equal(adminDiagnosticsResponse.status, 200);

    const adminMpesaHealthResponse = await app.request("/api/mpesa/health", {
      method: "GET",
      headers: adminSession.headers,
    });
    assert.equal(adminMpesaHealthResponse.status, 200);

    const adminMotherMeterAlertsResponse = await app.request(
      "/api/mother-meters/alerts/low-balance",
      {
        method: "GET",
        headers: adminSession.headers,
      },
    );
    assert.equal(adminMotherMeterAlertsResponse.status, 200);
  });
});
