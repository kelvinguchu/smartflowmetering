import type { ParsedGomelongFailureDetails } from "../meter-providers/gomelong-failure-policy";

const TERMINAL_STATUSES = new Set(["resolved", "refunded", "abandoned"]);

export type FailedTransactionStatus =
  | "pending_review"
  | "refunded"
  | "resolved"
  | "abandoned";
export type FailedTransactionReason =
  | "below_minimum"
  | "invalid_meter"
  | "manufacturer_error"
  | "meter_inactive"
  | "other"
  | "sms_failed";

export type FailedTransactionResolutionAction =
  | "abandoned_after_customer_follow_up"
  | "customer_advised_to_retry_above_minimum"
  | "customer_confirmed_correct_meter_for_retry"
  | "manual_review_documented"
  | "meter_status_follow_up_completed"
  | "provider_issue_reviewed_for_retry_or_refund"
  | "refund_completed"
  | "token_resent_or_delivered_via_alternate_channel";

export interface FailedTransactionGuidance {
  allowedResolutionActions: FailedTransactionResolutionAction[];
  caseId:
    | "invalid_meter_confirmation_required"
    | "manual_review_required"
    | "meter_status_correction_required"
    | "minimum_amount_followup_required"
    | "provider_failure_recovery_required"
    | "token_delivery_recovery_required";
  closurePrecondition: string;
  manualInterventionRequired: boolean;
  recommendedAction: string;
  recommendedClosureStatus: Exclude<FailedTransactionStatus, "pending_review">;
  resolutionRequired: boolean;
  summary: string;
}

export interface FailedTransactionWorkflowGuidance extends FailedTransactionGuidance {
  providerRetryDisposition:
    | "non_retryable"
    | "retryable"
    | "retryable_retries_exhausted"
    | null;
  shouldRetrySameRequest: boolean | null;
}

export function validateFailedTransactionStatusUpdate(input: {
  failureReason: FailedTransactionReason;
  nextStatus: FailedTransactionStatus;
  previousStatus: FailedTransactionStatus;
  resolutionAction?: FailedTransactionResolutionAction | null;
  resolutionNotes?: string | null;
}): { ok: true } | { message: string; ok: false } {
  const resolutionNotes = input.resolutionNotes?.trim();
  const isClosingStatus = input.nextStatus !== "pending_review";
  const resolutionAction = input.resolutionAction?.trim() as
    | FailedTransactionResolutionAction
    | undefined;
  const guidance = getFailedTransactionGuidance(input.failureReason);

  if (isClosingStatus && !resolutionNotes) {
    return {
      ok: false,
      message:
        "Resolution notes are required when closing a failed transaction review",
    };
  }

  if (isClosingStatus && !resolutionAction) {
    return {
      ok: false,
      message:
        "Resolution action is required when closing a failed transaction review",
    };
  }

  if (
    isClosingStatus &&
    resolutionAction &&
    !guidance.allowedResolutionActions.includes(resolutionAction)
  ) {
    return {
      ok: false,
      message:
        "Resolution action is not valid for this failed transaction reason",
    };
  }

  if (
    isClosingStatus &&
    input.nextStatus !== guidance.recommendedClosureStatus &&
    input.nextStatus !== "abandoned"
  ) {
    return {
      ok: false,
      message:
        "Closing status does not match the recommended workflow for this failed transaction reason",
    };
  }

  if (
    TERMINAL_STATUSES.has(input.previousStatus) &&
    input.nextStatus !== "pending_review" &&
    input.nextStatus !== input.previousStatus
  ) {
    return {
      ok: false,
      message:
        "Closed failed transactions must be reopened before moving to a different final status",
    };
  }

  return { ok: true };
}

export function getFailedTransactionGuidance(
  reason: FailedTransactionReason,
): FailedTransactionGuidance {
  switch (reason) {
    case "invalid_meter":
      return {
        allowedResolutionActions: [
          "customer_confirmed_correct_meter_for_retry",
          "refund_completed",
          "abandoned_after_customer_follow_up",
        ],
        caseId: "invalid_meter_confirmation_required",
        closurePrecondition:
          "Close only after the correct meter number is confirmed or the payment outcome is documented as refunded or abandoned",
        manualInterventionRequired: true,
        recommendedAction:
          "Confirm the correct meter number with the customer before any retry, manual recovery, or refund decision",
        recommendedClosureStatus: "resolved",
        resolutionRequired: true,
        summary:
          "Payment was received for a meter number that does not match a known meter",
      };
    case "below_minimum":
      return {
        allowedResolutionActions: [
          "customer_advised_to_retry_above_minimum",
          "refund_completed",
          "abandoned_after_customer_follow_up",
        ],
        caseId: "minimum_amount_followup_required",
        closurePrecondition:
          "Close only after the customer has been advised of the minimum amount rule and the follow-up outcome is recorded",
        manualInterventionRequired: true,
        recommendedAction:
          "Advise the customer to make a new payment that meets the minimum amount before any further recovery action",
        recommendedClosureStatus: "resolved",
        resolutionRequired: true,
        summary:
          "Payment was accepted below the configured minimum amount, so token generation never started",
      };
    case "manufacturer_error":
      return {
        allowedResolutionActions: [
          "provider_issue_reviewed_for_retry_or_refund",
          "refund_completed",
          "abandoned_after_customer_follow_up",
        ],
        caseId: "provider_failure_recovery_required",
        closurePrecondition:
          "Do not close until the provider failure has been reviewed and the recovery, refund, or closure decision is documented",
        manualInterventionRequired: true,
        recommendedAction:
          "Review provider failure details before deciding whether to retry token generation, recover manually, or refund",
        recommendedClosureStatus: "resolved",
        resolutionRequired: true,
        summary:
          "Payment reached internal processing, but token generation failed at the provider or manufacturer stage",
      };
    case "sms_failed":
      return {
        allowedResolutionActions: [
          "token_resent_or_delivered_via_alternate_channel",
          "refund_completed",
          "abandoned_after_customer_follow_up",
        ],
        caseId: "token_delivery_recovery_required",
        closurePrecondition:
          "Do not resolve until the customer has a usable token through resend or another verified delivery path",
        manualInterventionRequired: true,
        recommendedAction:
          "Resend the token or use an alternate verified delivery path before closing the successful payment case",
        recommendedClosureStatus: "resolved",
        resolutionRequired: true,
        summary:
          "Payment and token generation succeeded, but customer delivery failed on the SMS path",
      };
    case "meter_inactive":
      return {
        allowedResolutionActions: [
          "meter_status_follow_up_completed",
          "refund_completed",
          "abandoned_after_customer_follow_up",
        ],
        caseId: "meter_status_correction_required",
        closurePrecondition:
          "Close only after the meter status is corrected or the refund or abandonment outcome is recorded",
        manualInterventionRequired: true,
        recommendedAction:
          "Verify the meter status and coordinate activation or refund instead of retrying token generation immediately",
        recommendedClosureStatus: "resolved",
        resolutionRequired: true,
        summary:
          "Payment was received for a meter that exists but is not currently active",
      };
    case "other":
    default:
      return {
        allowedResolutionActions: [
          "manual_review_documented",
          "refund_completed",
          "abandoned_after_customer_follow_up",
        ],
        caseId: "manual_review_required",
        closurePrecondition:
          "Document the root cause and support action in the resolution notes before closing this case",
        manualInterventionRequired: true,
        recommendedAction:
          "Review failure details, payment context, and support history before choosing recovery, refund, or closure",
        recommendedClosureStatus: "resolved",
        resolutionRequired: true,
        summary:
          "Payment failed outside the standard recovery categories and needs manual triage",
      };
  }
}

export function getFailedTransactionWorkflowGuidance(input: {
  failureReason: FailedTransactionReason;
  providerFailure?: ParsedGomelongFailureDetails | null;
}): FailedTransactionWorkflowGuidance {
  const guidance = getFailedTransactionGuidance(input.failureReason);
  const providerFailure = input.providerFailure ?? null;

  if (
    input.failureReason !== "manufacturer_error" ||
    providerFailure === null
  ) {
    return {
      ...guidance,
      providerRetryDisposition: null,
      shouldRetrySameRequest: null,
    };
  }

  return {
    ...guidance,
    closurePrecondition: getProviderClosurePrecondition(providerFailure),
    providerRetryDisposition: providerFailure.disposition,
    recommendedAction:
      providerFailure.operatorAction ?? guidance.recommendedAction,
    shouldRetrySameRequest: providerFailure.retryable ?? null,
    summary: providerFailure.summary ?? guidance.summary,
  };
}

function getProviderClosurePrecondition(
  providerFailure: ParsedGomelongFailureDetails,
): string {
  if (providerFailure.disposition === "retryable") {
    return "Do not close while the provider retry path is still in flight; wait for the bounded retry outcome or document a manual refund or abandonment decision";
  }

  if (providerFailure.disposition === "retryable_retries_exhausted") {
    return "Do not close until the bounded provider retry path is exhausted and the final retry, refund, or abandonment decision is documented";
  }

  switch (providerFailure.category) {
    case "configuration_error":
      return "Do not retry until Gomelong credentials or provider configuration are corrected, or document the refund or abandonment outcome before closing";
    case "invalid_meter_or_contract":
    case "unsupported_request":
      return "Do not retry the same provider request unchanged; correct the provider-side contract or request parameters, or document the refund or abandonment outcome before closing";
    case "missing_token_after_success":
      return "Do not close until the provider response is reconciled and the customer outcome is documented as recovered, refunded, or abandoned";
    case "unknown_provider_failure":
    default:
      return "Do not close until the provider failure has been reviewed and a final retry, refund, or abandonment decision is documented";
  }
}
