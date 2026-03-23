export interface LandlordExceptionalStateSummary {
  companyPayment: {
    staleCount: number;
  };
  postpaid: {
    largeOutstandingCount: number;
  };
  prepaid: {
    negativeBalanceCount: number;
  };
  totalExceptionalMotherMeters: number;
}

export interface LandlordExceptionalMotherMeterStateItem {
  companyPaymentStatus: {
    daysSinceLastPayment: number | null;
    inactivityThresholdDays: number;
    isStale: boolean;
    lastBillPaymentAt: string | null;
  };
  motherMeter: {
    motherMeterNumber: string;
    type: "postpaid" | "prepaid";
  };
  postpaidStatus: {
    isLargeOutstanding: boolean;
    outstandingAmount: string;
    outstandingAmountThreshold: string;
  } | null;
  prepaidStatus: {
    estimatedBalance: string;
    isNegativeBalance: boolean;
  } | null;
}
