export interface TenantExceptionalStateSummary {
  criticalCount: number;
  count: number;
  warningCount: number;
}

export interface TenantExceptionalStateResponse {
  data: TenantExceptionalStateItem[];
  meter: {
    meterNumber: string;
    status: "active" | "inactive" | "suspended";
  };
  summary: TenantExceptionalStateSummary;
  thresholds: {
    pendingTokenMinutes: number;
    unacknowledgedTokenMinutes: number;
  };
}

interface TenantExceptionalStateBase {
  detectedAt: string;
  severity: "critical" | "warning";
}

export interface TenantMeterStatusExceptionalState
  extends TenantExceptionalStateBase {
  minutesSinceStatusChange: number;
  status: "inactive" | "suspended";
  type: "meter_inactive" | "meter_suspended";
}

export interface TenantPendingTokenExceptionalState
  extends TenantExceptionalStateBase {
  completedAt: string;
  meterCreditAmount: string;
  minutesSinceCompletion: number;
  mpesaReceiptNumber: string;
  transactionId: string;
  type: "token_pending_generation";
  unitsPurchased: string;
}

export interface TenantUnacknowledgedTokenExceptionalState
  extends TenantExceptionalStateBase {
  appNotificationStatus: "failed" | "missing" | "pending" | "sent";
  completedAt: string;
  maskedToken: string;
  meterCreditAmount: string;
  minutesSinceTokenGenerated: number;
  mpesaReceiptNumber: string;
  tokenGeneratedAt: string;
  transactionId: string;
  type: "token_available_unacknowledged";
  unitsPurchased: string;
}

export type TenantExceptionalStateItem =
  | TenantMeterStatusExceptionalState
  | TenantPendingTokenExceptionalState
  | TenantUnacknowledgedTokenExceptionalState;
