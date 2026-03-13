import { desc, eq } from "drizzle-orm";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import {
  customerAppNotifications,
  failedTransactions,
  mpesaTransactions,
  transactions,
} from "../../src/db/schema";
import { formatCustomerPromptContent } from "../../src/lib/customer-prompt-formatters";
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

void describe("E2E: customer prompts", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("lists failed-purchase and buy-token prompt candidates", async () => {
    const staleFixture = await ensureTestMeterFixture("PROMPT-STABLE-001");
    const failedFixture = await ensureTestMeterFixture("PROMPT-FAILED-001");
    const staffSession = await createAuthenticatedSession(app, "user");
    const stalePhoneNumber = uniqueKenyanPhoneNumber();
    const failedPhoneNumber = uniqueKenyanPhoneNumber();
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3_600_000);

    await db.insert(transactions).values({
      amountPaid: "250.00",
      commissionAmount: "25.00",
      completedAt: tenDaysAgo,
      createdAt: tenDaysAgo,
      meterId: staleFixture.meterId,
      mpesaReceiptNumber: uniqueRef("RCP"),
      netAmount: "225.00",
      paymentMethod: "paybill",
      phoneNumber: stalePhoneNumber,
      rateUsed: "25.0000",
      status: "completed",
      transactionId: uniqueRef("OHM-"),
      unitsPurchased: "9.0000",
    });

    const [mpesaTransaction] = await db
      .insert(mpesaTransactions)
      .values({
        billRefNumber: failedFixture.meterNumber,
        businessShortCode: "600100",
        msisdn: failedPhoneNumber,
        rawPayload: {},
        status: "failed",
        transAmount: "120.00",
        transId: uniqueRef("MPESA"),
        transTime: "20260313120000",
        transactionType: "Pay Bill",
      })
      .returning({ id: mpesaTransactions.id });

    await db.insert(failedTransactions).values({
      amount: "120.00",
      failureReason: "manufacturer_error",
      meterNumberAttempted: failedFixture.meterNumber,
      mpesaTransactionId: mpesaTransaction.id,
      phoneNumber: failedPhoneNumber,
      status: "pending_review",
    });

    const response = await app.request("/api/customer-prompts?type=all&limit=10", {
      method: "GET",
      headers: staffSession.headers,
    });

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      data: {
        meterNumber: string;
        phoneNumber: string;
        promptType: string;
      }[];
      summary: {
        buyTokenNudges: number;
        failedPurchaseFollowUps: number;
        total: number;
      };
    };

    assert.equal(body.summary.total, 2);
    assert.equal(body.summary.buyTokenNudges, 1);
    assert.equal(body.summary.failedPurchaseFollowUps, 1);
    assert.ok(
      body.data.some(
        (item) =>
          item.promptType === "buy_token_nudge" &&
          item.meterNumber === staleFixture.meterNumber &&
          item.phoneNumber === stalePhoneNumber,
      ),
    );
    assert.ok(
      body.data.some(
        (item) =>
          item.promptType === "failed_purchase_follow_up" &&
          item.meterNumber === failedFixture.meterNumber &&
          item.phoneNumber === failedPhoneNumber,
      ),
    );
  });

  void it("queues prompts and skips recent duplicates", async () => {
    const staleFixture = await ensureTestMeterFixture("PROMPT-STABLE-002");
    const failedFixture = await ensureTestMeterFixture("PROMPT-FAILED-002");
    const staffSession = await createAuthenticatedSession(app, "user");
    const stalePhoneNumber = uniqueKenyanPhoneNumber();
    const failedPhoneNumber = uniqueKenyanPhoneNumber();
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3_600_000);

    await db.insert(transactions).values({
      amountPaid: "300.00",
      commissionAmount: "30.00",
      completedAt: eightDaysAgo,
      createdAt: eightDaysAgo,
      meterId: staleFixture.meterId,
      mpesaReceiptNumber: uniqueRef("RCP"),
      netAmount: "270.00",
      paymentMethod: "paybill",
      phoneNumber: stalePhoneNumber,
      rateUsed: "25.0000",
      status: "completed",
      transactionId: uniqueRef("OHM-"),
      unitsPurchased: "10.8000",
    });

    const [mpesaTransaction] = await db
      .insert(mpesaTransactions)
      .values({
        billRefNumber: failedFixture.meterNumber,
        businessShortCode: "600100",
        msisdn: failedPhoneNumber,
        rawPayload: {},
        status: "failed",
        transAmount: "90.00",
        transId: uniqueRef("MPESA"),
        transTime: "20260313121000",
        transactionType: "Pay Bill",
      })
      .returning({ id: mpesaTransactions.id });

    await db.insert(failedTransactions).values({
      amount: "90.00",
      failureReason: "other",
      meterNumberAttempted: failedFixture.meterNumber,
      mpesaTransactionId: mpesaTransaction.id,
      phoneNumber: failedPhoneNumber,
      status: "pending_review",
    });

    const duplicatePrompt = formatCustomerPromptContent({
      amount: "90.00",
      createdAt: new Date(),
      dedupeKey: "ignored",
      meterNumber: failedFixture.meterNumber,
      phoneNumber: failedPhoneNumber,
      promptType: "failed_purchase_follow_up",
      referenceId: "ignored",
    });

    await db.insert(customerAppNotifications).values({
      message: duplicatePrompt.message,
      meterNumber: failedFixture.meterNumber,
      phoneNumber: failedPhoneNumber,
      referenceId: uniqueRef("PROMPT-"),
      title: duplicatePrompt.title,
      type: "failed_purchase_follow_up",
    });

    const response = await app.request("/api/customer-prompts/queue", {
      method: "POST",
      headers: staffSession.headers,
      body: JSON.stringify({
        maxPrompts: 10,
        staleDays: 7,
        type: "all",
      }),
    });

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      data: {
        buyTokenNudges: number;
        failed: number;
        failedPurchaseFollowUps: number;
        queued: number;
        skippedDuplicate: number;
        total: number;
      };
    };

    assert.equal(body.data.total, 2);
    assert.equal(body.data.buyTokenNudges, 1);
    assert.equal(body.data.failedPurchaseFollowUps, 1);
    assert.equal(body.data.queued, 1);
    assert.equal(body.data.skippedDuplicate, 1);
    assert.equal(body.data.failed, 0);

    const queuedNotifications = await db.query.customerAppNotifications.findMany({
      where: eq(customerAppNotifications.phoneNumber, stalePhoneNumber),
      orderBy: [desc(customerAppNotifications.createdAt)],
    });
    const queuedPrompt = formatCustomerPromptContent({
      amount: null,
      createdAt: new Date(),
      dedupeKey: "ignored",
      meterNumber: staleFixture.meterNumber,
      phoneNumber: stalePhoneNumber,
      promptType: "buy_token_nudge",
      referenceId: "ignored",
    });
    assert.ok(
      queuedNotifications.some(
        (notification) =>
          notification.message === queuedPrompt.message &&
          notification.title === queuedPrompt.title &&
          notification.status === "pending",
      ),
    );
  });
});
