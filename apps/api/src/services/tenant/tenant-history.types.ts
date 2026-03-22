export interface TenantHistorySummary {
  period: {
    endDate: string | null;
    startDate: string | null;
  };
  statusBreakdown: {
    completed: number;
    failed: number;
    pending: number;
    processing: number;
  };
  summary: {
    firstCompletedPurchaseAt: string | null;
    lastCompletedPurchaseAt: string | null;
    totalCompletedPurchases: number;
    totalMeterCreditAmount: string;
    totalUnitsPurchased: string;
  };
  paymentMethodBreakdown: {
    paybillCompletedCount: number;
    stkPushCompletedCount: number;
  };
}

export interface TenantRecoveryStateItem {
  completedAt: string | null;
  maskedToken: string | null;
  meterCreditAmount: string;
  paymentMethod: "paybill" | "stk_push";
  paymentStatus:
    | "completed"
    | "failed"
    | "pending"
    | "processing";
  recoveryState:
    | "payment_failed"
    | "payment_pending"
    | "payment_processing"
    | "token_acknowledged"
    | "token_available"
    | "token_pending_generation";
  tokenGeneratedAt: string | null;
  transactionId: string;
  unitsPurchased: string;
}
