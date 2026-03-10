import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { and, eq, sql } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import {
  adminNotifications,
  customers,
  meters,
  motherMeterEvents,
  motherMeters,
  smsLogs,
  transactions,
} from "../../src/db/schema";
import {
  createAuthenticatedSession,
  ensureInfraReady,
  ensureTestMeterFixture,
  resetE2EState,
  teardownE2E,
  uniqueRef,
  waitFor,
} from "./helpers";

const app = createApp();

describe("E2E: Notifications and daily purchase summaries", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  it("sends one daily purchase SMS with mother meter + submeter breakdown and totals", async () => {
    const fixture = await ensureTestMeterFixture("TEST-METER-A");
    const adminSession = await createAuthenticatedSession(app, "admin");
    const landlord = await db.query.customers.findFirst({
      where: eq(customers.id, fixture.customerId),
      columns: { phoneNumber: true },
    });
    assert.ok(landlord);

    const [secondaryMeter] = await db
      .insert(meters)
      .values({
        meterNumber: "TEST-METER-B",
        meterType: "electricity",
        brand: "hexing",
        motherMeterId: fixture.motherMeterId,
        tariffId: fixture.tariffId,
        supplyGroupCode: "600675",
        keyRevisionNumber: 1,
        tariffIndex: 1,
        status: "active",
      })
      .returning({ id: meters.id });

    const targetDate = "2026-03-04";
    const targetDayTimeOne = new Date("2026-03-04T12:30:00.000Z");
    const targetDayTimeTwo = new Date("2026-03-04T14:15:00.000Z");

    await db.insert(transactions).values([
      {
        transactionId: uniqueRef("OHM-A-"),
        meterId: fixture.meterId,
        phoneNumber: "254712345678",
        mpesaReceiptNumber: uniqueRef("RCP-A-"),
        amountPaid: "100.00",
        commissionAmount: "10.00",
        netAmount: "90.00",
        rateUsed: "25.0000",
        unitsPurchased: "3.6000",
        status: "completed",
        paymentMethod: "paybill",
        completedAt: targetDayTimeOne,
      },
      {
        transactionId: uniqueRef("OHM-B-"),
        meterId: secondaryMeter.id,
        phoneNumber: "254712345678",
        mpesaReceiptNumber: uniqueRef("RCP-B-"),
        amountPaid: "250.00",
        commissionAmount: "25.00",
        netAmount: "225.00",
        rateUsed: "25.0000",
        unitsPurchased: "9.0000",
        status: "completed",
        paymentMethod: "paybill",
        completedAt: targetDayTimeTwo,
      },
    ]);

    const response = await app.request("/api/notifications/run-daily-usage-sms", {
      method: "POST",
      headers: adminSession.headers,
      body: JSON.stringify({
        date: targetDate,
        timezone: "Africa/Nairobi",
      }),
    });
    const body = (await response.json()) as {
      queued: number;
      skippedDuplicate: number;
    };

    assert.equal(response.status, 200);
    assert.equal(body.queued, 1);
    assert.equal(body.skippedDuplicate, 0);

    await waitFor(async () => {
      const rows = await db
        .select({ id: smsLogs.id })
        .from(smsLogs)
        .where(
          and(
            eq(smsLogs.phoneNumber, landlord.phoneNumber),
            sql`${smsLogs.messageBody} like ${`%Daily Purchase Summary (${targetDate})%`}`
          )
        );
      return rows.length >= 1;
    });

    const [summaryLog] = await db
      .select({ messageBody: smsLogs.messageBody })
      .from(smsLogs)
      .where(eq(smsLogs.phoneNumber, landlord.phoneNumber))
      .orderBy(smsLogs.createdAt)
      .limit(1);

    assert.ok(summaryLog);
    assert.match(summaryLog.messageBody, /Daily Purchase Summary/);
    assert.match(summaryLog.messageBody, /MM-/);
    assert.match(summaryLog.messageBody, /TEST-METER-A/);
    assert.match(summaryLog.messageBody, /TEST-METER-B/);
    assert.match(summaryLog.messageBody, /Total Amount: KES 350\.00/);
    assert.match(summaryLog.messageBody, /Total Txns: 2/);

    const repeat = await app.request("/api/notifications/run-daily-usage-sms", {
      method: "POST",
      headers: adminSession.headers,
      body: JSON.stringify({
        date: targetDate,
        timezone: "Africa/Nairobi",
      }),
    });
    const repeatBody = (await repeat.json()) as {
      queued: number;
      skippedDuplicate: number;
    };
    assert.equal(repeat.status, 200);
    assert.equal(repeatBody.queued, 0);
    assert.equal(repeatBody.skippedDuplicate, 1);
  });

  it("creates low-balance and postpaid reminder admin notifications with dedupe", async () => {
    const fixture = await ensureTestMeterFixture("TEST-METER-ALERT");
    const adminSession = await createAuthenticatedSession(app, "admin");

    await db
      .update(motherMeters)
      .set({ type: "postpaid" })
      .where(eq(motherMeters.id, fixture.motherMeterId));

    await db.insert(motherMeterEvents).values({
      motherMeterId: fixture.motherMeterId,
      eventType: "bill_payment",
      amount: "500.00",
      performedBy: "00000000-0000-0000-0000-000000000000",
      createdAt: new Date(Date.now() - 15 * 86_400_000),
    });

    await db.insert(transactions).values({
      transactionId: uniqueRef("OHM-LOW-"),
      meterId: fixture.meterId,
      phoneNumber: "254700000001",
      mpesaReceiptNumber: uniqueRef("RCP-LOW-"),
      amountPaid: "200.00",
      commissionAmount: "20.00",
      netAmount: "180.00",
      rateUsed: "25.0000",
      unitsPurchased: "7.2000",
      status: "completed",
      paymentMethod: "paybill",
      completedAt: new Date(),
    });

    const run = await app.request("/api/notifications/run-alert-checks", {
      method: "POST",
      headers: adminSession.headers,
      body: JSON.stringify({
        daysAfterLastPayment: 13,
      }),
    });
    const runBody = (await run.json()) as {
      lowBalance: { queued: number };
      postpaid: { queued: number };
    };

    assert.equal(run.status, 200);
    assert.ok(runBody.lowBalance.queued >= 1);
    assert.ok(runBody.postpaid.queued >= 1);

    const lowBalanceRows = await db
      .select({ id: adminNotifications.id })
      .from(adminNotifications)
      .where(eq(adminNotifications.type, "mother_meter_low_balance"));
    const postpaidRows = await db
      .select({ id: adminNotifications.id })
      .from(adminNotifications)
      .where(eq(adminNotifications.type, "postpaid_payment_reminder"));

    assert.equal(lowBalanceRows.length, 1);
    assert.equal(postpaidRows.length, 1);

    const rerun = await app.request("/api/notifications/run-alert-checks", {
      method: "POST",
      headers: adminSession.headers,
      body: JSON.stringify({
        daysAfterLastPayment: 13,
      }),
    });
    const rerunBody = (await rerun.json()) as {
      lowBalance: { queued: number; skippedDuplicate: number };
      postpaid: { queued: number; skippedDuplicate: number };
    };

    assert.equal(rerun.status, 200);
    assert.equal(rerunBody.lowBalance.queued, 0);
    assert.ok(rerunBody.lowBalance.skippedDuplicate >= 1);
    assert.equal(rerunBody.postpaid.queued, 0);
    assert.ok(rerunBody.postpaid.skippedDuplicate >= 1);
  });
});
