export interface TenantDashboardSummary {
  activity: {
    lastPurchaseAt: string | null;
    totalCompletedPurchases: number;
  };
  meter: {
    meterNumber: string;
    meterType: "electricity" | "gas" | "water";
    status: "active" | "inactive" | "suspended";
  };
  motherMeter: {
    motherMeterNumber: string;
    type: "postpaid" | "prepaid";
  };
  property: {
    name: string;
  };
  totals: {
    totalMeterCreditAmount: string;
    totalUnitsPurchased: string;
  };
}

export interface TenantHistorySummary {
  paymentMethodBreakdown: {
    paybillCompletedCount: number;
    stkPushCompletedCount: number;
  };
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
}

export interface TenantPurchaseItem {
  completedAt: string | null;
  meterCreditAmount: string;
  mpesaReceiptNumber: string;
  paymentMethod: "paybill" | "stk_push";
  transactionId: string;
  unitsPurchased: string;
}

export interface TenantRecoveryStateItem {
  completedAt: string | null;
  maskedToken: string | null;
  meterCreditAmount: string;
  paymentMethod: "paybill" | "stk_push";
  paymentStatus: "completed" | "failed" | "pending" | "processing";
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

export interface TenantTokenDeliveryItem {
  completedAt: string | null;
  maskedToken: string | null;
  meterCreditAmount: string;
  mpesaReceiptNumber: string;
  status: "pending_token" | "token_available";
  tokenGeneratedAt: string | null;
  transactionId: string;
  unitsPurchased: string;
}

export interface TenantTokenDeliveryDetail extends TenantTokenDeliveryItem {
  smsDelivery: {
    deliveredAt: string | null;
    status: "delivered" | "failed" | "queued" | "sent";
    updatedAt: string;
  } | null;
}
