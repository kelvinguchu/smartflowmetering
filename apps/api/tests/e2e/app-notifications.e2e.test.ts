import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import { customerAppNotifications } from "../../src/db/schema";
import {
  createAuthenticatedSession,
  ensureInfraReady,
  ensureTestMeterFixture,
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

  void it("requires support staff to scope app notification and device token reads", async () => {
    const staffSession = await createAuthenticatedSession(app, "user");
    const phoneNumber = uniqueKenyanPhoneNumber();
    const token = "fcm-token-scope-abcdefghijklmnopqrstuvwxyz123456";

    await db.insert(customerAppNotifications).values({
      message: "Prompt body",
      meterNumber: "METER-SCOPE-1",
      phoneNumber,
      referenceId: `prompt-${phoneNumber}`,
      title: "Prompt title",
      type: "buy_token_nudge",
    });

    await app.request("/api/app-notifications/device-tokens", {
      method: "POST",
      headers: staffSession.headers,
      body: JSON.stringify({
        phoneNumber,
        platform: "android",
        token,
      }),
    });

    const broadNotificationsResponse = await app.request("/api/app-notifications", {
      method: "GET",
      headers: staffSession.headers,
    });
    assert.equal(broadNotificationsResponse.status, 403);

    const scopedNotificationsResponse = await app.request(
      `/api/app-notifications?phoneNumber=${phoneNumber}`,
      {
        method: "GET",
        headers: staffSession.headers,
      },
    );
    assert.equal(scopedNotificationsResponse.status, 200);

    const broadDeviceTokensResponse = await app.request(
      "/api/app-notifications/device-tokens",
      {
        method: "GET",
        headers: staffSession.headers,
      },
    );
    assert.equal(broadDeviceTokensResponse.status, 403);

    const scopedDeviceTokensResponse = await app.request(
      `/api/app-notifications/device-tokens?phoneNumber=${phoneNumber}`,
      {
        method: "GET",
        headers: staffSession.headers,
      },
    );
    assert.equal(scopedDeviceTokensResponse.status, 200);
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
    assert.equal(deleteResponse.status, 403);

    const mismatchedDeleteResponse = await app.request(
      `/api/app-notifications/device-tokens/${createdBody.data.id}?phoneNumber=${uniqueKenyanPhoneNumber()}`,
      {
        method: "DELETE",
        headers: staffSession.headers,
      },
    );
    assert.equal(mismatchedDeleteResponse.status, 403);

    const scopedDeleteResponse = await app.request(
      `/api/app-notifications/device-tokens/${createdBody.data.id}?phoneNumber=${phoneNumber}`,
      {
        method: "DELETE",
        headers: staffSession.headers,
      },
    );
    assert.equal(scopedDeleteResponse.status, 200);
    const deletedBody = (await scopedDeleteResponse.json()) as {
      data: { status: string };
    };
    assert.equal(deletedBody.data.status, "inactive");
  });

  void it("allows admins to deactivate customer device tokens without customer scope", async () => {
    const adminSession = await createAuthenticatedSession(app, "admin");
    const phoneNumber = uniqueKenyanPhoneNumber();
    const token = "fcm-token-admin-abcdefghijklmnopqrstuvwxyz123456";

    const createResponse = await app.request("/api/app-notifications/device-tokens", {
      method: "POST",
      headers: adminSession.headers,
      body: JSON.stringify({
        phoneNumber,
        platform: "android",
        token,
      }),
    });
    assert.equal(createResponse.status, 200);
    const createdBody = (await createResponse.json()) as {
      data: { id: string };
    };

    const deleteResponse = await app.request(
      `/api/app-notifications/device-tokens/${createdBody.data.id}`,
      {
        method: "DELETE",
        headers: adminSession.headers,
      },
    );
    assert.equal(deleteResponse.status, 200);
    const deletedBody = (await deleteResponse.json()) as {
      data: { status: string };
    };
    assert.equal(deletedBody.data.status, "inactive");
  });

  void it("allows staff to manage landlord device tokens by landlord id", async () => {
    const staffSession = await createAuthenticatedSession(app, "admin");
    const fixture = await ensureTestMeterFixture("LANDLORD-DEVICE-METER-001");
    const token = "fcm-token-landlord-abcdefghijklmnopqrstuvwxyz123456";

    const createResponse = await app.request("/api/app-notifications/device-tokens", {
      method: "POST",
      headers: staffSession.headers,
      body: JSON.stringify({
        landlordId: fixture.customerId,
        platform: "android",
        token,
      }),
    });
    assert.equal(createResponse.status, 200);

    const listResponse = await app.request(
      `/api/app-notifications/device-tokens?landlordId=${fixture.customerId}`,
      {
        method: "GET",
        headers: staffSession.headers,
      },
    );
    assert.equal(listResponse.status, 200);
    const listBody = (await listResponse.json()) as {
      count: number;
      data: { landlordId: string | null; token: string }[];
    };
    assert.equal(listBody.count, 1);
    assert.equal(listBody.data[0]?.landlordId, fixture.customerId);
    assert.equal(listBody.data[0]?.token, token);
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
    assert.equal(firstResponse.status, 403);

    const mismatchedResponse = await app.request(
      `/api/app-notifications/${notification.id}/requeue?phoneNumber=${uniqueKenyanPhoneNumber()}`,
      {
        method: "POST",
        headers: staffSession.headers,
      },
    );
    assert.equal(mismatchedResponse.status, 403);

    const scopedFirstResponse = await app.request(
      `/api/app-notifications/${notification.id}/requeue?phoneNumber=${phoneNumber}`,
      {
        method: "POST",
        headers: staffSession.headers,
      },
    );
    assert.equal(scopedFirstResponse.status, 200);
    const firstBody = (await scopedFirstResponse.json()) as {
      data: { jobId: string };
    };

    const secondResponse = await app.request(
      `/api/app-notifications/${notification.id}/requeue?phoneNumber=${phoneNumber}`,
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
