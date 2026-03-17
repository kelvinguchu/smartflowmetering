import type {
  FailedTransactionResolutionAction,
  FailedTransactionStatus,
} from "./failed-transaction-policy.service";

export interface SupportRecoverySearchCriteria {
  meterNumber?: string;
  mpesaReceiptNumber?: string;
  phoneNumber?: string;
  q?: string;
  transactionId?: string;
}

export interface SupportRecoveryMeterSummary {
  brand: string;
  meterNumber: string;
  meterType: string;
  motherMeterNumber: string | null;
  status: string;
  tariff: { name: string; ratePerKwh: string } | null;
}

export interface SupportRecoveryAssessment {
  allowedResolutionActions: FailedTransactionResolutionAction[];
  caseId:
    | "completed_without_token"
    | "payment_still_processing"
    | "provider_failure_before_token"
    | "sms_delivery_failed"
    | "sms_delivery_pending"
    | "token_delivery_confirmed"
    | "token_generated_no_sms";
  closurePrecondition: string;
  manualInterventionRequired: boolean;
  recommendedAction: string;
  recommendedClosureStatus: Exclude<
    FailedTransactionStatus,
    "pending_review"
  > | null;
  resolutionRequired: boolean;
  summary: string;
}

export interface SupportRecoveryResult {
  meter: SupportRecoveryMeterSummary | null;
  recentAdminTokens: {
    createdAt: Date;
    maskedToken: string;
    tokenType: string;
  }[];
  recentSmsLogs: {
    createdAt: Date;
    id: string;
    messageBody: string;
    phoneNumber: string;
    provider: string;
    status: string;
  }[];
  search: SupportRecoverySearchCriteria;
  transactions: {
    amountPaid: string;
    completedAt: Date | null;
    createdAt: Date;
    generatedTokens: {
      createdAt: Date;
      maskedToken: string;
      tokenType: string;
      value: string | null;
    }[];
    id: string;
    meter: SupportRecoveryMeterSummary;
    mpesaReceiptNumber: string;
    phoneNumber: string;
    recoveryAssessment: SupportRecoveryAssessment;
    smsLogs: {
      createdAt: Date;
      id: string;
      messageBody: string;
      provider: string;
      status: string;
    }[];
    status: string;
    transactionId: string;
    unitsPurchased: string;
  }[];
}
