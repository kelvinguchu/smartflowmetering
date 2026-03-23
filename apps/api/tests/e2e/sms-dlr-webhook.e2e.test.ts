import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { env } from "../../src/config";
import { db } from "../../src/db";
import { smsLogs } from "../../src/db/schema";
import {
  ensureInfraReady,
  resetE2EState,
  teardownE2E,
  uniqueKenyanPhoneNumber,
} from "./helpers";

const app = createApp();

void describe("E2E: HostPinnacle DLR webhook", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("updates an SMS log from an authenticated JSON DLR callback", async () => {
    const phoneNumber = uniqueKenyanPhoneNumber();
    const [smsLog] = await db
      .insert(smsLogs)
      .values({
        messageBody: "Token ***************7890 sent successfully",
        phoneNumber,
        provider: "hostpinnacle",
        providerMessageId: "MSG-001",
        status: "sent",
      })
      .returning({ id: smsLogs.id });

    const response = await app.request("/api/sms/webhooks/hostpinnacle/dlr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [env.HOSTPINNACLE_DLR_WEBHOOK_HEADER]: env.HOSTPINNACLE_DLR_WEBHOOK_TOKEN,
      },
      body: JSON.stringify({
        deliveredTime: "2026-03-13T15:45:00+03:00",
        errorCode: "0",
        messageId: "MSG-001",
        mobileNumber: phoneNumber,
        receivedTime: "2026-03-13T15:44:30+03:00",
        status: "Delivered",
      }),
    });

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      accepted: boolean;
      matched: boolean;
      smsLogId: string | null;
      status: string | null;
    };
    assert.equal(body.accepted, true);
    assert.equal(body.matched, true);
    assert.equal(body.smsLogId, smsLog.id);
    assert.equal(body.status, "delivered");

    const updatedLog = await db.query.smsLogs.findFirst({
      where: (table, { eq }) => eq(table.id, smsLog.id),
      columns: {
        providerDeliveredAt: true,
        providerErrorCode: true,
        providerReceivedAt: true,
        providerStatus: true,
        status: true,
      },
    });

    assert.ok(updatedLog);
    assert.equal(updatedLog.status, "delivered");
    assert.equal(updatedLog.providerStatus, "Delivered");
    assert.equal(updatedLog.providerErrorCode, "0");
    assert.ok(updatedLog.providerReceivedAt instanceof Date);
    assert.ok(updatedLog.providerDeliveredAt instanceof Date);
  });

  void it("rejects an invalid webhook token", async () => {
    const response = await app.request("/api/sms/webhooks/hostpinnacle/dlr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [env.HOSTPINNACLE_DLR_WEBHOOK_HEADER]: "wrong-token",
      },
      body: JSON.stringify({
        messageId: "MSG-REJECT",
        mobileNumber: uniqueKenyanPhoneNumber(),
        status: "Delivered",
      }),
    });

    assert.equal(response.status, 403);
  });

  void it("falls back to the latest phone-number match for GET callbacks without a message id", async () => {
    const phoneNumber = uniqueKenyanPhoneNumber();
    const [smsLog] = await db
      .insert(smsLogs)
      .values({
        messageBody: "Support reminder queued",
        phoneNumber,
        provider: "hostpinnacle",
        status: "queued",
      })
      .returning({ id: smsLogs.id });

    const response = await app.request(
      `/api/sms/webhooks/hostpinnacle/dlr?mobileNumber=${phoneNumber}&status=Failed&errorCode=104`,
      {
        method: "GET",
        headers: {
          [env.HOSTPINNACLE_DLR_WEBHOOK_HEADER]: env.HOSTPINNACLE_DLR_WEBHOOK_TOKEN,
        },
      },
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as { matched: boolean; status: string | null };
    assert.equal(body.matched, true);
    assert.equal(body.status, "failed");

    const updatedLog = await db.query.smsLogs.findFirst({
      where: (table, { eq }) => eq(table.id, smsLog.id),
      columns: {
        providerErrorCode: true,
        providerStatus: true,
        status: true,
      },
    });

    assert.ok(updatedLog);
    assert.equal(updatedLog.status, "failed");
    assert.equal(updatedLog.providerStatus, "Failed");
    assert.equal(updatedLog.providerErrorCode, "104");
  });
});
