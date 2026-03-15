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
  propertyId: string | null;
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
    id: string;
    motherMeterNumber: string;
    property: {
      id: string;
    };
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
