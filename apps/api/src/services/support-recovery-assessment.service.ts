import type { SupportRecoveryAssessment } from "./support-recovery.types";

interface SupportRecoveryAssessmentInput {
  generatedTokens: {
    tokenType: string;
  }[];
  smsLogs: {
    createdAt: Date;
    status: string;
  }[];
  status: string;
}

export function buildSupportRecoveryAssessment(
  input: SupportRecoveryAssessmentInput,
): SupportRecoveryAssessment {
  const creditTokens = input.generatedTokens.filter(
    (token) => token.tokenType === "credit",
  );
  const latestSmsLog = [...input.smsLogs].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  )[0];

  if (input.status === "pending" || input.status === "processing") {
    return {
      allowedResolutionActions: [],
      caseId: "payment_still_processing",
      closurePrecondition:
        "Do not close or promise manual recovery while payment processing is still in flight",
      manualInterventionRequired: false,
      recommendedAction:
        "Wait for the payment pipeline to finish or inspect queue and callback health before manual recovery",
      recommendedClosureStatus: null,
      resolutionRequired: false,
      summary:
        "Payment is still in progress and token delivery is not final yet",
    };
  }

  if (input.status === "failed") {
    return {
      allowedResolutionActions: [
        "provider_issue_reviewed_for_retry_or_refund",
        "refund_completed",
        "abandoned_after_customer_follow_up",
      ],
      caseId: "provider_failure_before_token",
      closurePrecondition:
        "Close only after provider failure review confirms retry, refund, or abandonment and that outcome is documented",
      manualInterventionRequired: true,
      recommendedAction:
        "Check provider and callback failure context before retrying, refunding, or closing the case",
      recommendedClosureStatus: "resolved",
      resolutionRequired: true,
      summary:
        "Payment failed before a recoverable token delivery path was established",
    };
  }

  if (creditTokens.length === 0) {
    return {
      allowedResolutionActions: [
        "provider_issue_reviewed_for_retry_or_refund",
        "manual_review_documented",
        "refund_completed",
        "abandoned_after_customer_follow_up",
      ],
      caseId: "completed_without_token",
      closurePrecondition:
        "Close only after token generation and provider reconciliation have been reviewed and the final customer outcome is documented",
      manualInterventionRequired: true,
      recommendedAction:
        "Verify token generation and provider reconciliation before promising delivery or closing the case",
      recommendedClosureStatus: "resolved",
      resolutionRequired: true,
      summary:
        "Payment completed but no credit token was recorded for delivery",
    };
  }

  if (!latestSmsLog) {
    return {
      allowedResolutionActions: [
        "token_resent_or_delivered_via_alternate_channel",
        "manual_review_documented",
        "refund_completed",
        "abandoned_after_customer_follow_up",
      ],
      caseId: "token_generated_no_sms",
      closurePrecondition:
        "Do not close until the customer has a usable token or a documented fallback outcome",
      manualInterventionRequired: true,
      recommendedAction:
        "Queue token delivery or use an alternate recovery channel because no SMS delivery attempt was recorded",
      recommendedClosureStatus: "resolved",
      resolutionRequired: true,
      summary: "A token exists, but no SMS delivery attempt was captured",
    };
  }

  if (latestSmsLog.status === "delivered") {
    return {
      allowedResolutionActions: [],
      caseId: "token_delivery_confirmed",
      closurePrecondition:
        "No manual closure path is needed unless the customer still cannot use the delivered token",
      manualInterventionRequired: false,
      recommendedAction:
        "Confirm the customer entered the delivered token correctly before any resend or refund action",
      recommendedClosureStatus: null,
      resolutionRequired: false,
      summary: "Token delivery is already confirmed on the latest SMS attempt",
    };
  }

  if (latestSmsLog.status === "queued" || latestSmsLog.status === "sent") {
    return {
      allowedResolutionActions: [],
      caseId: "sms_delivery_pending",
      closurePrecondition:
        "Do not close while delivery confirmation is still pending with the provider",
      manualInterventionRequired: false,
      recommendedAction:
        "Wait for delivery confirmation or sync the provider status before triggering another resend",
      recommendedClosureStatus: null,
      resolutionRequired: false,
      summary: "Token generation succeeded and SMS delivery is still in flight",
    };
  }

  return {
    allowedResolutionActions: [
      "token_resent_or_delivered_via_alternate_channel",
      "refund_completed",
      "abandoned_after_customer_follow_up",
    ],
    caseId: "sms_delivery_failed",
    closurePrecondition:
      "Do not close until the customer has a usable token through resend, alternate delivery, refund, or documented abandonment",
    manualInterventionRequired: true,
    recommendedAction:
      "Resend the token or use an alternate recovery path before closing the successful payment case",
    recommendedClosureStatus: "resolved",
    resolutionRequired: true,
    summary:
      "Payment and token generation succeeded, but the latest SMS delivery failed",
  };
}
