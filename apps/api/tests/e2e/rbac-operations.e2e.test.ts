import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app";
import {
  createAuthenticatedSession,
  ensureInfraReady,
  teardownE2E,
} from "./helpers";

const app = createApp();

void describe("E2E: RBAC admin-only operations", () => {
  before(async () => {
    await ensureInfraReady();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("keeps admin-only operations routes restricted to admins", async () => {
    const userSession = await createAuthenticatedSession(app, "user");
    const adminSession = await createAuthenticatedSession(app, "admin");

    const userNotificationsResponse = await app.request("/api/notifications", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(userNotificationsResponse.status, 403);

    const userFailedTransactionsResponse = await app.request("/api/failed-transactions", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(userFailedTransactionsResponse.status, 200);
    const userFailedTransactionsBody = (await userFailedTransactionsResponse.json()) as {
      count: number;
      data: Array<{ status: string }>;
    };
    assert.equal(
      userFailedTransactionsBody.data.every((item) => item.status === "pending_review"),
      true,
    );

    const userResolvedFailedTransactionsResponse = await app.request(
      "/api/failed-transactions?status=resolved",
      {
        method: "GET",
        headers: userSession.headers,
      },
    );
    assert.equal(userResolvedFailedTransactionsResponse.status, 403);

    const userFailedTransactionPatchResponse = await app.request(
      "/api/failed-transactions/00000000-0000-0000-0000-000000000000/status",
      {
        method: "PATCH",
        headers: userSession.headers,
        body: JSON.stringify({
          resolutionNotes: "Reviewed by support",
          status: "resolved",
        }),
      },
    );
    assert.notEqual(userFailedTransactionPatchResponse.status, 403);

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
        delivery: "none",
        meterNumber: "TEST-METER-001",
        reason: "Support test",
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

    const userSmsListResponse = await app.request("/api/sms", {
      method: "GET",
      headers: userSession.headers,
    });
    assert.equal(userSmsListResponse.status, 403);

    const userSmsResendResponse = await app.request(
      "/api/sms/resend/00000000-0000-0000-0000-000000000000",
      {
        method: "POST",
        headers: userSession.headers,
      },
    );
    assert.notEqual(userSmsResendResponse.status, 403);

    const userSmsTestResponse = await app.request("/api/sms/test", {
      method: "POST",
      headers: userSession.headers,
      body: JSON.stringify({
        message: "Test",
        phoneNumber: "+254700000000",
      }),
    });
    assert.equal(userSmsTestResponse.status, 403);

    const adminNotificationsResponse = await app.request("/api/notifications", {
      method: "GET",
      headers: adminSession.headers,
    });
    assert.equal(adminNotificationsResponse.status, 200);

    const adminFailedTransactionsResponse = await app.request("/api/failed-transactions", {
      method: "GET",
      headers: adminSession.headers,
    });
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

    const adminSmsListResponse = await app.request("/api/sms", {
      method: "GET",
      headers: adminSession.headers,
    });
    assert.equal(adminSmsListResponse.status, 200);
  });
});
