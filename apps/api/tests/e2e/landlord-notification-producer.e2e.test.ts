import { eq } from "drizzle-orm";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import {
  motherMeterEvents,
  motherMeters,
  transactions,
} from "../../src/db/schema";
import { queueDailyLandlordUsageSummarySms } from "../../src/services/daily-usage-sms.service";
import { queueLandlordSubMeterPurchaseNotification } from "../../src/services/landlord/landlord-notification-producer.service";
import {
  queueLowBalanceNotifications,
  queuePostpaidReminderNotifications,
} from "../../src/services/mother-meter-alerts.service";
import {
  createAuthenticatedSession,
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
  uniqueKenyanPhoneNumber,
  uniqueRef,
} from "./helpers";

const app = createApp();

void describe("E2E: landlord notification producer", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("creates a landlord daily usage summary app notification", async () => {
    const fixture = await ensureTestMeterFixture("LANDLORD-METER-001");
    const targetDate = "2026-03-13";

    await insertCompletedTransaction({
      amountPaid: "120.00",
      completedAt: new Date("2026-03-13T12:00:00.000Z"),
      fixture,
      mpesaReceiptNumber: uniqueRef("MPESA"),
      netAmount: "108.00",
      transactionId: uniqueRef("OHM"),
      unitsPurchased: "4.5000",
    });

    const result = await queueDailyLandlordUsageSummarySms({
      targetDate,
      timezone: "Africa/Nairobi",
    });

    assert.equal(result.appNotificationsCreated, 1);
    const notifications = await findNotifications("landlord_daily_usage_summary");
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.landlordId, fixture.customerId);
    assert.match(notifications[0]?.message ?? "", /Daily purchase summary/i);
  });

  void it("creates a landlord sub-meter purchase notification without duplicates", async () => {
    const fixture = await ensureTestMeterFixture("LANDLORD-METER-002");
    const referenceId = uniqueRef("LANDLORD-PURCHASE");

    const first = await queueLandlordSubMeterPurchaseNotification({
      amountPaid: "250.00",
      meterId: fixture.meterId,
      meterNumber: fixture.meterNumber,
      referenceId,
      unitsPurchased: "9.5000",
    });
    assert.equal(first.created, 1);

    const duplicate = await queueLandlordSubMeterPurchaseNotification({
      amountPaid: "250.00",
      meterId: fixture.meterId,
      meterNumber: fixture.meterNumber,
      referenceId,
      unitsPurchased: "9.5000",
    });
    assert.equal(duplicate.skippedDuplicate, 1);

    const notifications = await findNotifications("landlord_sub_meter_purchase");
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]?.message ?? "", /Sub-meter .* purchased/i);
  });

  void it("creates a landlord prepaid low-balance notification while postpaid remains dashboard data", async () => {
    const prepaidFixture = await ensureTestMeterFixture("LANDLORD-METER-003");
    await insertCompletedTransaction({
      amountPaid: "150.00",
      completedAt: new Date(),
      fixture: prepaidFixture,
      mpesaReceiptNumber: uniqueRef("MPESA"),
      netAmount: "150.00",
      transactionId: uniqueRef("LOWBAL"),
      unitsPurchased: "6.0000",
    });

    const lowBalanceResult = await queueLowBalanceNotifications({ maxAlerts: 5 });
    assert.equal(lowBalanceResult.appNotificationsCreated, 1);

    const postpaidFixture = await ensureTestMeterFixture("LANDLORD-METER-004");
    await db
      .update(motherMeters)
      .set({ type: "postpaid" })
      .where(eq(motherMeters.id, postpaidFixture.motherMeterId));
    await db.insert(motherMeterEvents).values({
      amount: "300.00",
      createdAt: new Date("2026-02-20T09:00:00.000Z"),
      eventType: "bill_payment",
      kplcReceiptNumber: uniqueRef("KPLC"),
      kplcToken: null,
      motherMeterId: postpaidFixture.motherMeterId,
      performedBy: "00000000-0000-0000-0000-000000000000",
    });

    const reminderResult = await queuePostpaidReminderNotifications({
      daysAfterLastPayment: 13,
      maxAlerts: 5,
    });
    assert.equal(reminderResult.appNotificationsCreated, 0);

    const lowBalanceNotifications = await findNotifications(
      "landlord_prepaid_low_balance",
    );
    assert.equal(lowBalanceNotifications.length, 1);
    assert.match(lowBalanceNotifications[0]?.title ?? "", /Prepaid balance alert/i);
  });

  void it("creates a landlord mother meter event notification when staff records an event", async () => {
    const fixture = await ensureTestMeterFixture("LANDLORD-METER-005");
    const admin = await createAuthenticatedSession(app, "admin");

    const response = await app.request(
      `/api/mother-meters/${fixture.motherMeterId}/events`,
      {
        method: "POST",
        headers: admin.headers,
        body: JSON.stringify({
          amount: 450,
          eventType: "refill",
          kplcReceiptNumber: uniqueRef("KPLC"),
        }),
      },
    );
    assert.equal(response.status, 201);

    const notifications = await findNotifications(
      "landlord_mother_meter_event_recorded",
    );
    assert.equal(notifications.length, 1);
    assert.match(
      notifications[0]?.message ?? "",
      /Mother meter refill was recorded/i,
    );
  });
});

async function findNotifications(
  type:
    | "landlord_daily_usage_summary"
    | "landlord_mother_meter_event_recorded"
    | "landlord_prepaid_low_balance"
    | "landlord_sub_meter_purchase",
) {
  return db.query.customerAppNotifications.findMany({
    where: (table, operators) => operators.eq(table.type, type),
  });
}

async function insertCompletedTransaction(input: {
  amountPaid: string;
  completedAt: Date;
  fixture: Awaited<ReturnType<typeof ensureTestMeterFixture>>;
  mpesaReceiptNumber: string;
  netAmount: string;
  transactionId: string;
  unitsPurchased: string;
}) {
  await db.insert(transactions).values({
    amountPaid: input.amountPaid,
    commissionAmount: "0.00",
    completedAt: input.completedAt,
    meterId: input.fixture.meterId,
    mpesaReceiptNumber: input.mpesaReceiptNumber,
    netAmount: input.netAmount,
    paymentMethod: "paybill",
    phoneNumber: uniqueKenyanPhoneNumber(),
    rateUsed: "25.0000",
    status: "completed",
    transactionId: input.transactionId,
    unitsPurchased: input.unitsPurchased,
  });
}

