export interface LandlordDashboardSummary {
  activity: {
    lastPurchaseAt: string | null;
    totalCompletedPurchases: number;
  };
  financials: {
    companyPaymentsToUtility: string;
    netSalesCollected: string;
    postpaidOutstandingAmount: string;
    prepaidEstimatedBalance: string;
    utilityFundingLoaded: string;
  };
  overview: {
    activeSubMeterCount: number;
    motherMeterCount: number;
    postpaidMotherMeterCount: number;
    prepaidMotherMeterCount: number;
    subMeterCount: number;
  };
}

export interface LandlordMotherMeterItem {
  activity: {
    lastBillPaymentAt: string | null;
    lastPurchaseAt: string | null;
    totalCompletedPurchases: number;
  };
  financials: {
    companyPaymentsToUtility: string;
    netSalesCollected: string;
    postpaidOutstandingAmount: string | null;
    prepaidEstimatedBalance: string | null;
    utilityFundingLoaded: string;
  };
  lowBalanceThreshold: string;
  motherMeterNumber: string;
  property: {
    location: string;
    name: string;
  };
  subMeters: LandlordSubMeterItem[];
  totals: {
    activeSubMeters: number;
    subMeters: number;
  };
  type: "postpaid" | "prepaid";
}

export interface LandlordPurchaseItem {
  completedAt: string | null;
  meter: {
    meterNumber: string;
    meterType: "electricity" | "gas" | "water";
    status: "active" | "inactive" | "suspended";
  };
  meterCreditAmount: string;
  motherMeter: {
    motherMeterNumber: string;
    type: "postpaid" | "prepaid";
  };
  mpesaReceiptNumber: string;
  paymentMethod: "paybill" | "stk_push";
  phoneNumber: string;
  status: "completed" | "failed" | "pending" | "processing";
  transactionId: string;
  unitsPurchased: string;
}

export interface LandlordSubMeterItem {
  activity: {
    lastPurchaseAt: string | null;
    totalCompletedPurchases: number;
  };
  meterNumber: string;
  meterType: "electricity" | "gas" | "water";
  status: "active" | "inactive" | "suspended";
  totalNetSales: string;
  totalUnitsPurchased: string;
}
