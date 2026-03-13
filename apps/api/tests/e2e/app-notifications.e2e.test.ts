import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import { customerAppNotifications } from "../../src/db/schema";
import {
  createAuthenticatedSession,
  ensureInfraReady,
  resetE2EState,
  teardownE2E,
  uniqueKenyanPhoneNumber,
} from "./helpers";

const app = createApp();

void describe("E2E: app notifications", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("allows staff to upsert, list, and deactivate customer device tokens", async () => {
    const staffSession = await createAuthenticatedSession(app, "user");
    const phoneNumber = uniqueKenyanPhoneNumber();
    const token = "fcm-token-abcdefghijklmnopqrstuvwxyz123456";

    const createResponse = await app.request("/api/app-notifications/device-tokens", {
      method: "POST",
      headers: staffSession.headers,
      body: JSON.stringify({
        phoneNumber,
        platform: "android",
        token,
      }),
    });
    assert.equal(createResponse.status, 200);
    const createdBody = (await createResponse.json()) as {
      data: { id: string; phoneNumber: string; status: string; token: string };
    };
    assert.equal(createdBody.data.phoneNumber, phoneNumber);
    assert.equal(createdBody.data.status, "active");
    assert.equal(createdBody.data.token, token);

    const listResponse = await app.request(
      `/api/app-notifications/device-tokens?phoneNumber=${phoneNumber}`,
      {
        method: "GET",
        headers: staffSession.headers,
      },
    );
    assert.equal(listResponse.status, 200);
    const listBody = (await listResponse.json()) as {
      count: number;
      data: { id: string; token: string }[];
    };
    assert.equal(listBody.count, 1);
    assert.equal(listBody.data[0]?.id, createdBody.data.id);

    const deleteResponse = await app.request(
      `/api/app-notifications/device-tokens/${createdBody.data.id}`,
      {
        method: "DELETE",
        headers: staffSession.headers,
      },
    );
    assert.equal(deleteResponse.status, 200);
    const deletedBody = (await deleteResponse.json()) as {
      data: { status: string };
    };
    assert.equal(deletedBody.data.status, "inactive");
  });

  void it("deduplicates queued app notification delivery jobs", async () => {
    const staffSession = await createAuthenticatedSession(app, "user");
    const phoneNumber = uniqueKenyanPhoneNumber();
    const [notification] = await db
      .insert(customerAppNotifications)
      .values({
        message: "Prompt body",
        meterNumber: "METER-QUEUE-1",
        phoneNumber,
        referenceId: `prompt-${phoneNumber}`,
        title: "Prompt title",
        type: "buy_token_nudge",
      })
      .returning({ id: customerAppNotifications.id });

    const firstResponse = await app.request(
      `/api/app-notifications/${notification.id}/requeue`,
      {
        method: "POST",
        headers: staffSession.headers,
      },
    );
    assert.equal(firstResponse.status, 200);
    const firstBody = (await firstResponse.json()) as {
      data: { jobId: string };
    };

    const secondResponse = await app.request(
      `/api/app-notifications/${notification.id}/requeue`,
      {
        method: "POST",
        headers: staffSession.headers,
      },
    );
    assert.equal(secondResponse.status, 200);
    const secondBody = (await secondResponse.json()) as {
      data: { jobId: string };
    };

    assert.equal(secondBody.data.jobId, firstBody.data.jobId);
  });
});
