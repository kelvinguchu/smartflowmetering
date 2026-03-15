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

void describe("E2E: sms provider health", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("returns provider failure and fallback visibility for staff", async () => {
    const staffSession = await createAuthenticatedSession(app, "user");

    await db.insert(smsLogs).values([
      {
        messageBody: "A",
        phoneNumber: uniqueKenyanPhoneNumber(),
        provider: "hostpinnacle",
        status: "delivered",
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
        providerMessageId: "TS-100",
        status: "sent",
      },
    ]);

    const response = await app.request("/api/sms/provider-health?hours=24", {
      method: "GET",
      headers: staffSession.headers,
    });

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      data: {
        hostpinnacle: {
          attempted: number;
          delivered: number;
          failed: number;
          pending: number;
          failureRate: number;
        };
        overall: {
          delivered: number;
          failed: number;
          pending: number;
          total: number;
        };
        textsms: {
          attempted: number;
          delivered: number;
          failed: number;
          fallbackUsageRate: number;
          pending: number;
          pendingDlrSync: number;
        };
        windowHours: number;
      };
    };

    assert.equal(body.data.windowHours, 24);
    assert.equal(body.data.overall.total, 3);
    assert.equal(body.data.hostpinnacle.attempted, 2);
    assert.equal(body.data.hostpinnacle.failed, 1);
    assert.equal(body.data.hostpinnacle.failureRate, 50);
    assert.equal(body.data.textsms.attempted, 1);
    assert.equal(body.data.textsms.pendingDlrSync, 1);
    assert.equal(body.data.textsms.fallbackUsageRate, 33.33);
  });
});
