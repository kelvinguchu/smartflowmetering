export interface LandlordMotherMeterDetail {
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
  id: string;
  lowBalanceThreshold: string;
  motherMeterNumber: string;
  property: {
    id: string;
    location: string;
    name: string;
  };
  recentEvents: LandlordMotherMeterEventItem[];
  recentPurchases: LandlordMotherMeterPurchaseItem[];
  subMeters: {
    activity: {
      lastPurchaseAt: string | null;
      totalCompletedPurchases: number;
    };
    id: string;
    meterNumber: string;
    meterType: "electricity" | "gas" | "water";
    status: "active" | "inactive" | "suspended";
    totalNetSales: string;
    totalUnitsPurchased: string;
  }[];
  totals: {
    activeSubMeters: number;
    subMeters: number;
  };
  type: "postpaid" | "prepaid";
}

export interface LandlordMotherMeterEventItem {
  amount: string;
  createdAt: string;
  eventType: "bill_payment" | "initial_deposit" | "refill";
  id: string;
  kplcReceiptNumber: string | null;
  kplcToken: string | null;
}

export interface LandlordMotherMeterPurchaseItem {
  completedAt: string | null;
  meterCreditAmount: string;
  meterNumber: string;
  mpesaReceiptNumber: string;
  phoneNumber: string;
  transactionId: string;
  unitsPurchased: string;
}

export interface LandlordUsageHistoryItem {
  date: string;
  latestPurchaseAt: string | null;
  meterCreditAmountTotal: string;
  motherMeter: {
    id: string;
    motherMeterNumber: string;
    type: "postpaid" | "prepaid";
  };
  subMeters: LandlordUsageHistorySubMeterItem[];
  totals: {
    subMetersWithPurchases: number;
    transactionCount: number;
    unitsPurchased: string;
  };
}

export interface LandlordUsageHistorySubMeterItem {
  lastPurchaseAt: string | null;
  meterCreditAmountTotal: string;
  meterNumber: string;
  transactionCount: number;
  unitsPurchased: string;
}
