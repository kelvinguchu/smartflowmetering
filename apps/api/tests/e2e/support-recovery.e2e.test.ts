import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import { generatedTokens, smsLogs, transactions } from "../../src/db/schema";
import { protectToken } from "../../src/lib/token-protection";
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

void describe("E2E: support recovery", () => {
  before(async () => {
    await ensureInfraReady();
  });

  beforeEach(async () => {
    await resetE2EState();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("lets support staff search by phone and see transaction, token, and sms context", async () => {
    const fixture = await ensureTestMeterFixture("SUPPORT-METER-001");
    const staffSession = await createAuthenticatedSession(app, "user");
    const phoneNumber = uniqueKenyanPhoneNumber();
    const localPhoneNumber = `0${phoneNumber.slice(3)}`;
    const [transaction] = await db
      .insert(transactions)
      .values({
        amountPaid: "150.00",
        commissionAmount: "15.00",
        meterId: fixture.meterId,
        mpesaReceiptNumber: uniqueRef("RCP"),
        netAmount: "135.00",
        paymentMethod: "stk_push",
        phoneNumber,
        rateUsed: "25.0000",
        status: "completed",
        transactionId: uniqueRef("OHM-"),
        unitsPurchased: "5.4000",
      })
      .returning();

    await db.insert(generatedTokens).values({
      generatedBy: "system",
      meterId: fixture.meterId,
      token: protectToken("12345678901234567890"),
      tokenType: "credit",
      transactionId: transaction.id,
      value: "5.4000",
    });

    await db.insert(smsLogs).values({
      messageBody: "Token 12345678901234567890 sent successfully",
      phoneNumber,
      provider: "hostpinnacle",
      status: "failed",
      transactionId: transaction.id,
    });

    const response = await app.request(
      `/api/support-recovery?phoneNumber=${localPhoneNumber}`,
      {
        method: "GET",
        headers: staffSession.headers,
      },
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      data: {
        meter: { meterNumber: string } | null;
        recentAdminTokens: { maskedToken: string; tokenType: string }[];
        recentSmsLogs: {
          messageBody: string;
          phoneNumber: string;
          status: string;
        }[];
        search: { phoneNumber?: string };
        transactions: {
          generatedTokens: { maskedToken: string; tokenType: string }[];
          meter: { meterNumber: string };
          phoneNumber: string;
          recoveryAssessment: {
            allowedResolutionActions: string[];
            caseId: string;
            closurePrecondition: string;
            manualInterventionRequired: boolean;
            recommendedAction: string;
            recommendedClosureStatus: string | null;
            resolutionRequired: boolean;
          };
          smsLogs: { messageBody: string; status: string }[];
          transactionId: string;
        }[];
      };
    };

    assert.equal(body.data.search.phoneNumber, phoneNumber);
    assert.equal(body.data.meter?.meterNumber, fixture.meterNumber);
    assert.equal(body.data.transactions.length, 1);
    assert.equal(body.data.transactions[0].phoneNumber, phoneNumber);
    assert.equal(
      body.data.transactions[0].meter.meterNumber,
      fixture.meterNumber,
    );
    assert.equal(
      body.data.transactions[0].generatedTokens[0].tokenType,
      "credit",
    );
    assert.match(
      body.data.transactions[0].generatedTokens[0].maskedToken,
      /^\*+\d{4}$/,
    );
    assert.equal(body.data.transactions[0].smsLogs[0].status, "failed");
    assert.equal(
      body.data.transactions[0].recoveryAssessment.caseId,
      "sms_delivery_failed",
    );
    assert.equal(
      body.data.transactions[0].recoveryAssessment.manualInterventionRequired,
      true,
    );
    assert.equal(
      body.data.transactions[0].recoveryAssessment.recommendedClosureStatus,
      "resolved",
    );
    assert.equal(
      body.data.transactions[0].recoveryAssessment.resolutionRequired,
      true,
    );
    assert.ok(
      body.data.transactions[0].recoveryAssessment.allowedResolutionActions.includes(
        "token_resent_or_delivered_via_alternate_channel",
      ),
    );
    assert.match(
      body.data.transactions[0].recoveryAssessment.recommendedAction,
      /resend|alternate recovery/i,
    );
    assert.match(
      body.data.transactions[0].recoveryAssessment.closurePrecondition,
      /usable token|alternate delivery|refund|abandon/i,
    );
    assert.equal(body.data.recentSmsLogs[0].phoneNumber, phoneNumber);
    assert.ok(
      body.data.transactions[0].smsLogs[0].messageBody.includes("****"),
    );
    assert.equal("motherMeter" in body.data.transactions[0].meter, false);
    assert.equal(
      "providerMessageId" in body.data.transactions[0].smsLogs[0],
      false,
    );
    assert.equal(body.data.recentAdminTokens.length, 0);
  });

  void it("flags completed transactions with tokens but no sms attempt as manual recovery", async () => {
    const fixture = await ensureTestMeterFixture("SUPPORT-METER-004");
    const staffSession = await createAuthenticatedSession(app, "user");
    const phoneNumber = uniqueKenyanPhoneNumber();
    const [transaction] = await db
      .insert(transactions)
      .values({
        amountPaid: "180.00",
        commissionAmount: "18.00",
        meterId: fixture.meterId,
        mpesaReceiptNumber: uniqueRef("RCP"),
        netAmount: "162.00",
        paymentMethod: "stk_push",
        phoneNumber,
        rateUsed: "25.0000",
        status: "completed",
        transactionId: uniqueRef("OHM-"),
        unitsPurchased: "6.4800",
      })
      .returning();

    await db.insert(generatedTokens).values({
      generatedBy: "system",
      meterId: fixture.meterId,
      token: protectToken("11112222333344445555"),
      tokenType: "credit",
      transactionId: transaction.id,
      value: "6.4800",
    });

    const response = await app.request(
      `/api/support-recovery?meterNumber=${fixture.meterNumber}`,
      {
        method: "GET",
        headers: staffSession.headers,
      },
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      data: {
        transactions: {
          recoveryAssessment: {
            allowedResolutionActions: string[];
            caseId: string;
            recommendedClosureStatus: string | null;
            resolutionRequired: boolean;
            manualInterventionRequired: boolean;
            summary: string;
          };
        }[];
      };
    };

    assert.equal(body.data.transactions.length, 1);
    assert.equal(
      body.data.transactions[0].recoveryAssessment.caseId,
      "token_generated_no_sms",
    );
    assert.equal(
      body.data.transactions[0].recoveryAssessment.manualInterventionRequired,
      true,
    );
    assert.equal(
      body.data.transactions[0].recoveryAssessment.recommendedClosureStatus,
      "resolved",
    );
    assert.equal(
      body.data.transactions[0].recoveryAssessment.resolutionRequired,
      true,
    );
    assert.ok(
      body.data.transactions[0].recoveryAssessment.allowedResolutionActions.includes(
        "token_resent_or_delivered_via_alternate_channel",
      ),
    );
    assert.match(
      body.data.transactions[0].recoveryAssessment.summary,
      /no sms delivery attempt/i,
    );
  });

  void it("includes recent admin token history when searching by meter number", async () => {
    const fixture = await ensureTestMeterFixture("SUPPORT-METER-002");
    const adminSession = await createAuthenticatedSession(app, "admin");
    const userSession = await createAuthenticatedSession(app, "user");

    await db.insert(generatedTokens).values({
      generatedBy: "admin",
      meterId: fixture.meterId,
      token: protectToken("98765432109876543210"),
      tokenType: "clear_tamper",
      value: null,
    });

    const response = await app.request(
      `/api/support-recovery?q=${fixture.meterNumber}`,
      {
        method: "GET",
        headers: adminSession.headers,
      },
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      data: {
        meter: { meterNumber: string } | null;
        recentAdminTokens: { maskedToken: string; tokenType: string }[];
      };
    };

    assert.equal(body.data.meter?.meterNumber, fixture.meterNumber);
    assert.equal(body.data.recentAdminTokens.length, 1);
    assert.equal(body.data.recentAdminTokens[0].tokenType, "clear_tamper");
    assert.match(body.data.recentAdminTokens[0].maskedToken, /^\*+\d{4}$/);
    assert.equal("id" in body.data.recentAdminTokens[0], false);

    const supportResponse = await app.request(
      `/api/support-recovery?q=${fixture.meterNumber}`,
      {
        method: "GET",
        headers: userSession.headers,
      },
    );

    assert.equal(supportResponse.status, 403);

    const scopedSupportResponse = await app.request(
      `/api/support-recovery?meterNumber=${fixture.meterNumber}`,
      {
        method: "GET",
        headers: userSession.headers,
      },
    );

    assert.equal(scopedSupportResponse.status, 200);
    const supportBody = (await scopedSupportResponse.json()) as {
      data: {
        recentAdminTokens: unknown[];
      };
    };
    assert.equal(supportBody.data.recentAdminTokens.length, 0);
  });

  void it("keeps support recovery available to staff and blocked for non-staff", async () => {
    const fixture = await ensureTestMeterFixture("SUPPORT-METER-003");
    const staffSession = await createAuthenticatedSession(app, "user");
    const adminSession = await createAuthenticatedSession(app, "admin");

    const staffResponse = await app.request(
      `/api/support-recovery?meterNumber=${fixture.meterNumber}`,
      {
        method: "GET",
        headers: staffSession.headers,
      },
    );
    assert.equal(staffResponse.status, 200);

    const adminResponse = await app.request(
      `/api/support-recovery?meterNumber=${fixture.meterNumber}`,
      {
        method: "GET",
        headers: adminSession.headers,
      },
    );
    assert.equal(adminResponse.status, 200);

    const anonymousResponse = await app.request(
      `/api/support-recovery?meterNumber=${fixture.meterNumber}`,
      {
        method: "GET",
      },
    );
    assert.equal(anonymousResponse.status, 401);
  });
});
