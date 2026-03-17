import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getFailedTransactionGuidance,
  validateFailedTransactionStatusUpdate,
} from "../src/services/failed-transaction-policy.service";

void describe("failed transaction policy", () => {
  void it("requires resolution notes when closing a failed transaction", () => {
    const result = validateFailedTransactionStatusUpdate({
      failureReason: "invalid_meter",
      nextStatus: "resolved",
      previousStatus: "pending_review",
      resolutionAction: "customer_confirmed_correct_meter_for_retry",
      resolutionNotes: "",
    });

    assert.equal(result.ok, false);
  });

  void it("prevents direct terminal-to-terminal status changes", () => {
    const result = validateFailedTransactionStatusUpdate({
      failureReason: "other",
      nextStatus: "refunded",
      previousStatus: "resolved",
      resolutionAction: "refund_completed",
      resolutionNotes: "Switching outcome",
    });

    assert.equal(result.ok, false);
  });

  void it("allows reopening a closed failed transaction", () => {
    const result = validateFailedTransactionStatusUpdate({
      failureReason: "other",
      nextStatus: "pending_review",
      previousStatus: "resolved",
      resolutionNotes: null,
    });

    assert.deepEqual(result, { ok: true });
  });

  void it("provides explicit workflow guidance for each failure reason", () => {
    const cases = [
      {
        reason: "invalid_meter",
        caseId: "invalid_meter_confirmation_required",
        allowedResolutionAction: "customer_confirmed_correct_meter_for_retry",
        recommendedActionPattern: /correct meter number/i,
      },
      {
        reason: "below_minimum",
        caseId: "minimum_amount_followup_required",
        allowedResolutionAction: "customer_advised_to_retry_above_minimum",
        recommendedActionPattern: /minimum amount/i,
      },
      {
        reason: "manufacturer_error",
        caseId: "provider_failure_recovery_required",
        allowedResolutionAction: "provider_issue_reviewed_for_retry_or_refund",
        recommendedActionPattern:
          /retry token generation|recover manually|refund/i,
      },
      {
        reason: "sms_failed",
        caseId: "token_delivery_recovery_required",
        allowedResolutionAction:
          "token_resent_or_delivered_via_alternate_channel",
        recommendedActionPattern: /resend the token|delivery path/i,
      },
      {
        reason: "meter_inactive",
        caseId: "meter_status_correction_required",
        allowedResolutionAction: "meter_status_follow_up_completed",
        recommendedActionPattern: /meter status|activation|refund/i,
      },
      {
        reason: "other",
        caseId: "manual_review_required",
        allowedResolutionAction: "manual_review_documented",
        recommendedActionPattern: /review failure details|support history/i,
      },
    ] as const;

    for (const testCase of cases) {
      const guidance = getFailedTransactionGuidance(testCase.reason);

      assert.equal(guidance.caseId, testCase.caseId);
      assert.equal(guidance.manualInterventionRequired, true);
      assert.equal(guidance.resolutionRequired, true);
      assert.equal(guidance.recommendedClosureStatus, "resolved");
      assert.ok(
        guidance.allowedResolutionActions.includes(
          testCase.allowedResolutionAction,
        ),
      );
      assert.ok(guidance.summary.length > 0);
      assert.ok(guidance.closurePrecondition.length > 0);
      assert.match(
        guidance.recommendedAction,
        testCase.recommendedActionPattern,
      );
    }
  });

  void it("requires a valid resolution action when closing a failed transaction", () => {
    const missingAction = validateFailedTransactionStatusUpdate({
      failureReason: "below_minimum",
      nextStatus: "resolved",
      previousStatus: "pending_review",
      resolutionNotes: "Customer advised to retry with correct amount",
    });

    assert.equal(missingAction.ok, false);

    const invalidAction = validateFailedTransactionStatusUpdate({
      failureReason: "below_minimum",
      nextStatus: "resolved",
      previousStatus: "pending_review",
      resolutionAction: "token_resent_or_delivered_via_alternate_channel",
      resolutionNotes: "Tried to use SMS action on a minimum amount failure",
    });

    assert.equal(invalidAction.ok, false);
  });
});
