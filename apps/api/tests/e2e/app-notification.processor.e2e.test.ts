import type { Job } from "bullmq";
import type { BatchResponse } from "firebase-admin/messaging";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { db } from "../../src/db";
import {
  customerAppNotifications,
  customerDeviceTokens,
} from "../../src/db/schema";
import type { MessagingLike } from "../../src/lib/firebase-admin";
import { setFirebaseMessagingForTests } from "../../src/lib/firebase-admin";
import { processAppNotificationDelivery } from "../../src/queues/processors/app-notification.processor";
import type { AppNotificationDeliveryJob } from "../../src/queues/types";
import {
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
  uniqueKenyanPhoneNumber,
  uniqueRef,
} from "./helpers";

void describe("E2E: app notification processor", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    setFirebaseMessagingForTests(null);
    await resetE2EState();
  });

  after(async () => {
    setFirebaseMessagingForTests(null);
    await teardownE2E();
  });

  void it("marks a notification as sent when FCM delivers successfully", async () => {
    const phoneNumber = uniqueKenyanPhoneNumber();
    await db.insert(customerDeviceTokens).values({
      phoneNumber,
      platform: "android",
      token: `token-${uniqueRef("fcm")}`,
    });

    const [notification] = await db
      .insert(customerAppNotifications)
      .values({
        message: "Body",
        meterNumber: "METER-1",
        phoneNumber,
        referenceId: uniqueRef("ref"),
        title: "Title",
        type: "buy_token_nudge",
      })
      .returning({ id: customerAppNotifications.id });

    const messaging: MessagingLike = {
      sendEachForMulticast: () => {
        const response: BatchResponse = {
          failureCount: 0,
          responses: [{ success: true }],
          successCount: 1,
        };
        return Promise.resolve(response);
      },
    };
    setFirebaseMessagingForTests(messaging);

    const result = await processAppNotificationDelivery(
      {
        data: { customerAppNotificationId: notification.id },
      } as Job<AppNotificationDeliveryJob>,
    );

    assert.equal(result.deliveredTokens, 1);
    const stored = await db.query.customerAppNotifications.findFirst({
      where: (table, { eq }) => eq(table.id, notification.id),
    });
    assert.ok(stored);
    assert.equal(stored.status, "sent");
    assert.ok(stored.sentAt instanceof Date);
  });

  void it("invalidates bad tokens and still marks sent when at least one token succeeds", async () => {
    const phoneNumber = uniqueKenyanPhoneNumber();
    const validToken = `token-${uniqueRef("ok")}`;
    const invalidToken = `token-${uniqueRef("bad")}`;
    await db.insert(customerDeviceTokens).values([
      {
        phoneNumber,
        platform: "android",
        token: validToken,
      },
      {
        phoneNumber,
        platform: "android",
        token: invalidToken,
      },
    ]);

    const [notification] = await db
      .insert(customerAppNotifications)
      .values({
        message: "Body",
        meterNumber: "METER-2",
        phoneNumber,
        referenceId: uniqueRef("ref"),
        title: "Title",
        type: "failed_purchase_follow_up",
      })
      .returning({ id: customerAppNotifications.id });

    const messaging: MessagingLike = {
      sendEachForMulticast: () => {
        const response: BatchResponse = {
          failureCount: 1,
          responses: [
            { success: true },
            {
              error: {
                code: "messaging/registration-token-not-registered",
                message: "bad token",
                toJSON() {
                  return {};
                },
              },
              success: false,
            },
          ],
          successCount: 1,
        };
        return Promise.resolve(response);
      },
    };
    setFirebaseMessagingForTests(messaging);

    await processAppNotificationDelivery(
      {
        data: { customerAppNotificationId: notification.id },
      } as Job<AppNotificationDeliveryJob>,
    );

    const stored = await db.query.customerAppNotifications.findFirst({
      where: (table, { eq }) => eq(table.id, notification.id),
    });
    assert.ok(stored);
    assert.equal(stored.status, "sent");

    const invalidated = await db.query.customerDeviceTokens.findFirst({
      where: (table, { eq }) => eq(table.token, invalidToken),
    });
    assert.ok(invalidated);
    assert.equal(invalidated.status, "inactive");
    assert.equal(invalidated.invalidationReason, "fcm_invalid_token");
  });

  void it("marks a notification failed after the final retryable error", async () => {
    const phoneNumber = uniqueKenyanPhoneNumber();
    await db.insert(customerDeviceTokens).values({
      phoneNumber,
      platform: "android",
      token: `token-${uniqueRef("retry")}`,
    });

    const [notification] = await db
      .insert(customerAppNotifications)
      .values({
        message: "Body",
        meterNumber: "METER-3",
        phoneNumber,
        referenceId: uniqueRef("ref"),
        title: "Title",
        type: "buy_token_nudge",
      })
      .returning({ id: customerAppNotifications.id });

    const messaging: MessagingLike = {
      sendEachForMulticast: () => {
        const response: BatchResponse = {
          failureCount: 1,
          responses: [
            {
              error: {
                code: "messaging/server-unavailable",
                message: "temporary outage",
                toJSON() {
                  return {};
                },
              },
              success: false,
            },
          ],
          successCount: 0,
        };
        return Promise.resolve(response);
      },
    };
    setFirebaseMessagingForTests(messaging);

    await assert.rejects(async () => {
      await processAppNotificationDelivery(
        {
          attemptsMade: 2,
          data: { customerAppNotificationId: notification.id },
          opts: { attempts: 3 },
        } as Job<AppNotificationDeliveryJob>,
      );
    });

    const stored = await db.query.customerAppNotifications.findFirst({
      where: (table, { eq }) => eq(table.id, notification.id),
    });
    assert.ok(stored);
    assert.equal(stored.status, "failed");
    assert.equal(stored.deliveryAttempts, 1);
    assert.equal(stored.lastFailureCode, "messaging/server-unavailable");
    assert.equal(stored.lastFailureMessage, "temporary outage");
    assert.ok(stored.lastAttemptAt instanceof Date);
  });

  void it("delivers landlord notifications using landlord-scoped device tokens", async () => {
    const fixture = await ensureTestMeterFixture("LANDLORD-PUSH-METER-001");
    const token = `token-${uniqueRef("landlord")}`;

    await db.insert(customerDeviceTokens).values({
      landlordId: fixture.customerId,
      platform: "android",
      token,
    });

    const [notification] = await db
      .insert(customerAppNotifications)
      .values({
        landlordId: fixture.customerId,
        message: "Landlord summary body",
        meterNumber: "MM-LANDLORD-1",
        referenceId: uniqueRef("summary"),
        title: "Daily usage summary",
        type: "landlord_daily_usage_summary",
      })
      .returning({ id: customerAppNotifications.id });

    const messaging: MessagingLike = {
      sendEachForMulticast: () => {
        const response: BatchResponse = {
          failureCount: 0,
          responses: [{ success: true }],
          successCount: 1,
        };
        return Promise.resolve(response);
      },
    };
    setFirebaseMessagingForTests(messaging);

    const result = await processAppNotificationDelivery(
      {
        data: { customerAppNotificationId: notification.id },
      } as Job<AppNotificationDeliveryJob>,
    );

    assert.equal(result.deliveredTokens, 1);
    const stored = await db.query.customerAppNotifications.findFirst({
      where: (table, { eq }) => eq(table.id, notification.id),
    });
    assert.ok(stored);
    assert.equal(stored.status, "sent");
  });
});
