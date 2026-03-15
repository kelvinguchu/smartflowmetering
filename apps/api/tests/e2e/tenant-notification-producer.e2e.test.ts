import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import { queueTenantNotificationsForMeter } from "../../src/services/tenant-notification-producer.service";
import {
  createAuthenticatedSession,
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
} from "./helpers";

const app = createApp();

void describe("E2E: tenant notification producer", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("creates token purchase recorded notifications for active tenant accesses", async () => {
    const fixture = await ensureTestMeterFixture("TENANT-PRODUCER-001");
    await bootstrapTenantAccess(fixture.meterNumber);

    const result = await queueTenantNotificationsForMeter({
      amountPaid: "120.00",
      meterId: fixture.meterId,
      meterNumber: fixture.meterNumber,
      metadata: { transactionId: "TX-001" },
      referenceId: "transaction-row-1",
      type: "token_purchase_recorded",
      unitsPurchased: "4.50",
    });

    assert.equal(result.created, 1);
    const notifications = await db.query.customerAppNotifications.findMany({
      where: (table, { eq }) => eq(table.meterNumber, fixture.meterNumber),
    });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.type, "token_purchase_recorded");
    assert.equal(notifications[0]?.tenantAccessId !== null, true);
  });

  void it("does not duplicate tenant notifications for the same reference and type", async () => {
    const fixture = await ensureTestMeterFixture("TENANT-PRODUCER-002");
    await bootstrapTenantAccess(fixture.meterNumber);

    await queueTenantNotificationsForMeter({
      meterId: fixture.meterId,
      meterNumber: fixture.meterNumber,
      metadata: { transactionId: "TX-002" },
      referenceId: "transaction-row-2",
      type: "token_delivery_available",
      unitsPurchased: "3.00",
    });
    const second = await queueTenantNotificationsForMeter({
      meterId: fixture.meterId,
      meterNumber: fixture.meterNumber,
      metadata: { transactionId: "TX-002" },
      referenceId: "transaction-row-2",
      type: "token_delivery_available",
      unitsPurchased: "3.00",
    });

    assert.equal(second.created, 0);
    const notifications = await db.query.customerAppNotifications.findMany({
      where: (table, { eq }) => eq(table.meterNumber, fixture.meterNumber),
    });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.type, "token_delivery_available");
  });

  void it("creates a meter status alert when staff suspend a meter", async () => {
    const fixture = await ensureTestMeterFixture("TENANT-PRODUCER-003");
    await bootstrapTenantAccess(fixture.meterNumber);
    const adminSession = await createAuthenticatedSession(app, "admin");

    const response = await app.request(`/api/meters/${fixture.meterId}/suspend`, {
      method: "POST",
      headers: adminSession.headers,
    });
    assert.equal(response.status, 200);

    const notifications = await db.query.customerAppNotifications.findMany({
      where: (table, { eq }) => eq(table.meterNumber, fixture.meterNumber),
    });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.type, "meter_status_alert");
    assert.match(notifications[0]?.message ?? "", /suspended/i);
  });
});

async function bootstrapTenantAccess(meterNumber: string): Promise<void> {
  const response = await app.request("/api/mobile/tenant-access/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meterNumber }),
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    data: { tenantAccess: { id: string } };
  };
  const access = await db.query.tenantAppAccesses.findFirst({
    where: (table, { eq }) => eq(table.id, body.data.tenantAccess.id),
    columns: { id: true },
  });
  assert.ok(access);
}
