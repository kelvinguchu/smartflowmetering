import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import { customerAppNotifications } from "../../src/db/schema";
import {
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
} from "./helpers";
import { getLatestTenantAccessIdForMeter } from "./tenant-access-test-helpers";

const app = createApp();

void describe("E2E: tenant access", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("bootstraps tenant access from an active sub-meter serial", async () => {
    const fixture = await ensureTestMeterFixture("TENANT-METER-001");

    const response = await app.request("/api/mobile/tenant-access/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meterNumber: fixture.meterNumber }),
    });

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      data: {
        accessToken: string;
        tenantAccess: {
          meter: {
            meterNumber: string;
            meterType: string;
            motherMeterNumber: string;
            propertyName: string;
          };
        };
      };
    };
    assert.match(body.data.accessToken, /^[a-f0-9]{64}$/);
    assert.equal(body.data.tenantAccess.meter.meterNumber, fixture.meterNumber);
    assert.equal(body.data.tenantAccess.meter.motherMeterNumber, fixture.motherMeterNumber);
    assert.ok(body.data.tenantAccess.meter.propertyName.length > 0);
    assert.equal(Object.prototype.hasOwnProperty.call(body.data.tenantAccess, "id"), false);
  });

  void it("allows a tenant access token to load context and register a device token", async () => {
    const fixture = await ensureTestMeterFixture("TENANT-METER-002");
    const bootstrapResponse = await app.request(
      "/api/mobile/tenant-access/bootstrap",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meterNumber: fixture.meterNumber }),
      },
    );
    const bootstrapBody = (await bootstrapResponse.json()) as {
      data: {
        accessToken: string;
      };
    };
    const headers = {
      Authorization: `Bearer ${bootstrapBody.data.accessToken}`,
      "Content-Type": "application/json",
    };

    const meResponse = await app.request("/api/mobile/tenant-access/me", {
      method: "GET",
      headers,
    });
    assert.equal(meResponse.status, 200);
    const meBody = (await meResponse.json()) as {
      data: {
        id?: string;
        meter: {
          meterNumber: string;
          motherMeterNumber: string;
        };
      };
    };
    assert.equal(meBody.data.meter.meterNumber, fixture.meterNumber);
    assert.equal(meBody.data.meter.motherMeterNumber, fixture.motherMeterNumber);
    assert.equal(Object.prototype.hasOwnProperty.call(meBody.data, "id"), false);

    const token = "tenant-fcm-token-abcdefghijklmnopqrstuvwxyz123456";
    const deviceResponse = await app.request(
      "/api/mobile/tenant-access/device-tokens",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          platform: "android",
          token,
        }),
      },
    );
    assert.equal(deviceResponse.status, 200);
    const deviceBody = (await deviceResponse.json()) as {
      data: { platform: string; status: string; tenantAccessId?: string | null; token?: string };
    };
    assert.equal(deviceBody.data.platform, "android");
    assert.equal(deviceBody.data.status, "active");
    assert.equal(
      Object.prototype.hasOwnProperty.call(deviceBody.data, "tenantAccessId"),
      false,
    );
    assert.equal(Object.prototype.hasOwnProperty.call(deviceBody.data, "token"), false);
  });

  void it("marks a tenant-scoped app notification as read", async () => {
    const fixture = await ensureTestMeterFixture("TENANT-METER-003");
    const bootstrapResponse = await app.request(
      "/api/mobile/tenant-access/bootstrap",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meterNumber: fixture.meterNumber }),
      },
    );
    const bootstrapBody = (await bootstrapResponse.json()) as {
      data: {
        accessToken: string;
      };
    };
    const tenantAccessId = await getLatestTenantAccessIdForMeter(fixture.meterId);

    const [notification] = await db
      .insert(customerAppNotifications)
      .values({
        message: "Your meter usage summary is ready",
        meterNumber: fixture.meterNumber,
        referenceId: `tenant-${fixture.meterNumber}`,
        tenantAccessId,
        title: "Usage update",
        type: "buy_token_nudge",
      })
      .returning({ id: customerAppNotifications.id });

    const response = await app.request(
      `/api/mobile/tenant-access/notifications/${notification.id}/read`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bootstrapBody.data.accessToken}`,
        },
      },
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      data: { readAt: string | null; status: string; tenantAccessId?: string | null };
    };
    assert.equal(body.data.status, "read");
    assert.ok(body.data.readAt);
    assert.equal(Object.prototype.hasOwnProperty.call(body.data, "tenantAccessId"), false);
  });

  void it("lists only the notifications that belong to the authenticated tenant access", async () => {
    const firstFixture = await ensureTestMeterFixture("TENANT-METER-004");
    const secondFixture = await ensureTestMeterFixture("TENANT-METER-005");

    const firstBootstrapResponse = await app.request(
      "/api/mobile/tenant-access/bootstrap",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meterNumber: firstFixture.meterNumber }),
      },
    );
    const secondBootstrapResponse = await app.request(
      "/api/mobile/tenant-access/bootstrap",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meterNumber: secondFixture.meterNumber }),
      },
    );

    const firstBootstrapBody = (await firstBootstrapResponse.json()) as {
      data: { accessToken: string };
    };
    await secondBootstrapResponse.json();
    const firstTenantAccessId = await getLatestTenantAccessIdForMeter(firstFixture.meterId);
    const secondTenantAccessId = await getLatestTenantAccessIdForMeter(secondFixture.meterId);

    await db.insert(customerAppNotifications).values([
      {
        message: "First tenant pending message",
        meterNumber: firstFixture.meterNumber,
        referenceId: `tenant-${firstFixture.meterNumber}-1`,
        tenantAccessId: firstTenantAccessId,
        title: "First tenant",
        type: "buy_token_nudge",
      },
      {
        message: "First tenant read message",
        meterNumber: firstFixture.meterNumber,
        readAt: new Date(),
        referenceId: `tenant-${firstFixture.meterNumber}-2`,
        status: "read",
        tenantAccessId: firstTenantAccessId,
        title: "First tenant read",
        type: "token_delivery_available",
      },
      {
        message: "Second tenant message",
        meterNumber: secondFixture.meterNumber,
        referenceId: `tenant-${secondFixture.meterNumber}-1`,
        tenantAccessId: secondTenantAccessId,
        title: "Second tenant",
        type: "buy_token_nudge",
      },
    ]);

    const response = await app.request(
      "/api/mobile/tenant-access/notifications?status=read&type=token_delivery_available",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${firstBootstrapBody.data.accessToken}`,
        },
      },
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      count: number;
      data: { message: string; status: string; tenantAccessId?: string | null }[];
      pagination: {
        hasMore: boolean;
        limit: number | null;
        nextOffset: number | null;
        offset: number;
      };
    };

    assert.equal(body.count, 1);
    assert.equal(body.pagination.limit, null);
    assert.equal(body.pagination.offset, 0);
    assert.equal(body.pagination.hasMore, false);
    assert.equal(body.pagination.nextOffset, null);
    assert.equal(body.data[0]?.message, "First tenant read message");
    assert.equal(body.data[0]?.status, "read");
    assert.equal(
      Object.prototype.hasOwnProperty.call(body.data[0] ?? {}, "tenantAccessId"),
      false,
    );
  });
});
