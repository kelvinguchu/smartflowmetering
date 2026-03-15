import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import { smsLogs } from "../../src/db/schema";
import {
  createAuthenticatedSession,
  ensureInfraReady,
  resetE2EState,
  teardownE2E,
  uniqueKenyanPhoneNumber,
} from "./helpers";

const app = createApp();

void describe("E2E: sms provider alerts", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("creates admin notifications for provider outage signals", async () => {
    const adminSession = await createAuthenticatedSession(app, "admin");

    await db.insert(smsLogs).values([
      {
        messageBody: "A",
        phoneNumber: uniqueKenyanPhoneNumber(),
        provider: "hostpinnacle",
        status: "failed",
      },
      {
        messageBody: "B",
        phoneNumber: uniqueKenyanPhoneNumber(),
        provider: "hostpinnacle",
        status: "failed",
      },
      {
        messageBody: "C",
        phoneNumber: uniqueKenyanPhoneNumber(),
        provider: "textsms",
        providerMessageId: "TS-1",
        status: "sent",
      },
    ]);

    const response = await app.request("/api/notifications/run-sms-provider-alerts", {
      method: "POST",
      headers: {
        ...adminSession.headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        hostpinnacleFailureRatePercent: 50,
        minFailedCount: 2,
        textsmsFallbackUsageRatePercent: 20,
        textsmsPendingDlrThreshold: 1,
        windowHours: 24,
      }),
    });

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      created: string[];
      createdCount: number;
    };

    assert.equal(body.createdCount, 3);
    assert.equal(body.created.length, 3);

    const notifications = await db.query.adminNotifications.findMany({
      orderBy: (table, { asc }) => [asc(table.createdAt)],
      columns: {
        entityId: true,
        severity: true,
        type: true,
      },
    });

    assert.equal(notifications.length, 3);
    assert.deepEqual(
      notifications.map((notification) => notification.type),
      ["sms_provider_outage", "sms_provider_outage", "sms_provider_outage"],
    );
    assert.deepEqual(
      notifications.map((notification) => notification.entityId),
      [
        "hostpinnacle-window-24",
        "textsms-fallback-window-24",
        "textsms-dlr-backlog-window-24",
      ],
    );
    assert.deepEqual(
      notifications.map((notification) => notification.severity),
      ["critical", "warning", "warning"],
    );
  });
});
