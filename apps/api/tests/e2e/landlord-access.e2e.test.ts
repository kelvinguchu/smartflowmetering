import { eq } from "drizzle-orm";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import {
  customerAppNotifications,
  customers,
  user,
  verification,
} from "../../src/db/schema";
import {
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
  uniqueRef,
} from "./helpers";

const app = createApp();

void describe("E2E: landlord access", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("sends and verifies OTP for a registered landlord phone number", async () => {
    const fixture = await ensureTestMeterFixture("LANDLORD-OTP-METER-001");
    const landlord = await db.query.customers.findFirst({
      where: eq(customers.id, fixture.customerId),
    });
    assert.ok(landlord);
    const localPhoneNumber = `0${landlord.phoneNumber.slice(3)}`;

    const sendResponse = await app.request("/api/mobile/landlord-access/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: localPhoneNumber }),
    });
    assert.equal(sendResponse.status, 200);

    const otpVerification = await db.query.verification.findFirst({
      where: eq(verification.identifier, landlord.phoneNumber),
    });
    assert.ok(otpVerification);
    const [code] = otpVerification.value.split(":");
    assert.ok(code);

    const verifyResponse = await app.request("/api/mobile/landlord-access/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, phoneNumber: localPhoneNumber }),
    });
    assert.equal(verifyResponse.status, 200);
    const verifyBody = (await verifyResponse.json()) as {
      data: {
        landlordAccess: {
          customerId?: string;
          motherMeters: { id: string; propertyId: string }[];
          properties: { id: string }[];
        };
        token: string;
        user: { id?: string; role: string };
      };
    };
    assert.equal(
      verifyBody.data.landlordAccess.properties.some((item) => item.id === fixture.propertyId),
      true,
    );
    assert.equal(
      verifyBody.data.landlordAccess.motherMeters.some(
        (item) =>
          item.id === fixture.motherMeterId && item.propertyId === fixture.propertyId,
      ),
      true,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(verifyBody.data.landlordAccess, "customerId"),
      false,
    );
    assert.equal(verifyBody.data.user.role, "landlord");
    assert.equal(
      Object.prototype.hasOwnProperty.call(verifyBody.data.user, "id"),
      false,
    );
    assert.ok(verifyBody.data.token.length > 20);

    const linkedCustomer = await db.query.customers.findFirst({
      where: eq(customers.id, fixture.customerId),
    });
    assert.ok(linkedCustomer?.userId);

    const authUser = await db.query.user.findFirst({
      where: eq(user.id, linkedCustomer.userId),
    });
    assert.equal(authUser?.role, "landlord");

    const meResponse = await app.request("/api/mobile/landlord-access/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${verifyBody.data.token}` },
    });
    assert.equal(meResponse.status, 200);
    const meBody = (await meResponse.json()) as {
      data: {
        landlordAccess: { customerId?: string };
        user: { id?: string; role: string };
      };
    };
    assert.equal(
      Object.prototype.hasOwnProperty.call(meBody.data.landlordAccess, "customerId"),
      false,
    );
    assert.equal(Object.prototype.hasOwnProperty.call(meBody.data.user, "id"), false);
  });

  void it("lists landlord notifications, marks them read, and saves device tokens", async () => {
    const fixture = await ensureTestMeterFixture("LANDLORD-OTP-METER-002");
    const otherFixture = await ensureTestMeterFixture("LANDLORD-OTP-METER-003");
    const token = await loginAsLandlord(fixture.customerId);

    const [notification] = await db
      .insert(customerAppNotifications)
      .values({
        landlordId: fixture.customerId,
        message: "Usage summary is ready",
        metadata: {
          motherMeterId: fixture.motherMeterId,
          propertyId: fixture.propertyId,
        },
        meterNumber: "MM-TEST-01",
        phoneNumber: null,
        referenceId: uniqueRef("landlord-summary"),
        title: "Daily usage summary",
        type: "landlord_daily_usage_summary",
      })
      .returning({ id: customerAppNotifications.id });
    await db.insert(customerAppNotifications).values({
      landlordId: fixture.customerId,
      message: "Other property notification",
      metadata: {
        motherMeterId: otherFixture.motherMeterId,
        propertyId: otherFixture.propertyId,
      },
      meterNumber: "MM-TEST-02",
      phoneNumber: null,
      referenceId: uniqueRef("landlord-summary"),
      title: "Prepaid balance alert",
      type: "landlord_prepaid_low_balance",
    });

    const notificationsResponse = await app.request(
      "/api/mobile/landlord-access/notifications",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(notificationsResponse.status, 200);
    const notificationsBody = (await notificationsResponse.json()) as {
      count: number;
      data: { id: string; landlordId?: string; metadata: Record<string, unknown> | null }[];
    };
    assert.equal(notificationsBody.count, 2);
    assert.ok(notificationsBody.data.some((item) => item.id === notification.id));
    assert.equal(
      Object.prototype.hasOwnProperty.call(notificationsBody.data[0] ?? {}, "landlordId"),
      false,
    );
    assert.equal(notificationsBody.data[0]?.metadata, null);

    const filteredResponse = await app.request(
      `/api/mobile/landlord-access/notifications?propertyId=${fixture.propertyId}&motherMeterId=${fixture.motherMeterId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(filteredResponse.status, 200);
    const filteredBody = (await filteredResponse.json()) as {
      count: number;
      data: { id: string; metadata: Record<string, unknown> | null }[];
    };
    assert.equal(filteredBody.count, 1);
    assert.equal(filteredBody.data[0]?.id, notification.id);
    assert.equal(filteredBody.data[0]?.metadata, null);

    const deviceTokenResponse = await app.request(
      "/api/mobile/landlord-access/device-tokens",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform: "android",
          token: "fcm-landlord-token-abcdefghijklmnopqrstuvwxyz123456",
        }),
      },
    );
    assert.equal(deviceTokenResponse.status, 200);
    const deviceTokenBody = (await deviceTokenResponse.json()) as {
      data: { landlordId?: string | null; platform: string; status: string };
    };
    assert.equal(deviceTokenBody.data.platform, "android");
    assert.equal(deviceTokenBody.data.status, "active");
    assert.equal(
      Object.prototype.hasOwnProperty.call(deviceTokenBody.data, "landlordId"),
      false,
    );

    const readResponse = await app.request(
      `/api/mobile/landlord-access/notifications/${notification.id}/read`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(readResponse.status, 200);
    const readBody = (await readResponse.json()) as {
      data: { landlordId?: string; metadata: Record<string, unknown> | null; status: string };
    };
    assert.equal(readBody.data.status, "read");
    assert.equal(Object.prototype.hasOwnProperty.call(readBody.data, "landlordId"), false);
    assert.equal(readBody.data.metadata, null);
  });
});

async function loginAsLandlord(customerId: string): Promise<string> {
  const landlord = await db.query.customers.findFirst({
    where: eq(customers.id, customerId),
  });
  assert.ok(landlord);

  const sendResponse = await app.request("/api/mobile/landlord-access/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: landlord.phoneNumber }),
  });
  assert.equal(sendResponse.status, 200);

  const otpVerification = await db.query.verification.findFirst({
    where: eq(verification.identifier, landlord.phoneNumber),
  });
  assert.ok(otpVerification);
  const [code] = otpVerification.value.split(":");
  assert.ok(code);

  const verifyResponse = await app.request("/api/mobile/landlord-access/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, phoneNumber: landlord.phoneNumber }),
  });
  assert.equal(verifyResponse.status, 200);
  const verifyBody = (await verifyResponse.json()) as {
    data: { token: string };
  };

  return verifyBody.data.token;
}
