import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSupportRecoveryAssessment } from "../src/services/support/support-recovery-assessment.service";

describe("support recovery assessment", () => {
  it("returns structured closure guidance for manual recovery cases", () => {
    const providerFailure = buildSupportRecoveryAssessment({
      generatedTokens: [],
      providerFailure: null,
      smsLogs: [],
      status: "failed",
    });

    assert.equal(providerFailure.caseId, "provider_failure_before_token");
    assert.equal(providerFailure.manualInterventionRequired, true);
    assert.equal(providerFailure.resolutionRequired, true);
    assert.equal(providerFailure.recommendedClosureStatus, "resolved");
    assert.ok(
      providerFailure.allowedResolutionActions.includes(
        "provider_issue_reviewed_for_retry_or_refund",
      ),
    );
    assert.match(
      providerFailure.closurePrecondition,
      /retry|refund|abandonment/i,
    );

    const smsFailed = buildSupportRecoveryAssessment({
      generatedTokens: [{ tokenType: "credit" }],
      providerFailure: null,
      smsLogs: [
        { createdAt: new Date("2026-03-17T08:00:00.000Z"), status: "failed" },
      ],
      status: "completed",
    });

    assert.equal(smsFailed.caseId, "sms_delivery_failed");
    assert.equal(smsFailed.manualInterventionRequired, true);
    assert.equal(smsFailed.resolutionRequired, true);
    assert.equal(smsFailed.recommendedClosureStatus, "resolved");
    assert.ok(
      smsFailed.allowedResolutionActions.includes(
        "token_resent_or_delivered_via_alternate_channel",
      ),
    );
  });

  it("returns no closure actions for in-flight or already-confirmed delivery", () => {
    const processing = buildSupportRecoveryAssessment({
      generatedTokens: [],
      providerFailure: null,
      smsLogs: [],
      status: "processing",
    });

    assert.equal(processing.caseId, "payment_still_processing");
    assert.equal(processing.manualInterventionRequired, false);
    assert.equal(processing.resolutionRequired, false);
    assert.equal(processing.recommendedClosureStatus, null);
    assert.equal(processing.allowedResolutionActions.length, 0);

    const delivered = buildSupportRecoveryAssessment({
      generatedTokens: [{ tokenType: "credit" }],
      providerFailure: null,
      smsLogs: [
        {
          createdAt: new Date("2026-03-17T09:00:00.000Z"),
          status: "delivered",
        },
      ],
      status: "completed",
    });

    assert.equal(delivered.caseId, "token_delivery_confirmed");
    assert.equal(delivered.manualInterventionRequired, false);
    assert.equal(delivered.resolutionRequired, false);
    assert.equal(delivered.recommendedClosureStatus, null);
    assert.equal(delivered.allowedResolutionActions.length, 0);
  });
});

