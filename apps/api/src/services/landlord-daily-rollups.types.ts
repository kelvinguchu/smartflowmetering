export interface LandlordMotherMeterDailyRollupItem {
  date: string;
  financialSnapshot: {
    companyPaymentsToUtility: string;
    netSalesCollected: string;
    postpaidOutstandingAmount: string | null;
    prepaidEstimatedBalance: string | null;
    utilityFundingLoaded: string;
  };
  motherMeter: {
    id: string;
    motherMeterNumber: string;
    type: "postpaid" | "prepaid";
  };
  totals: {
    companyPaymentsToUtility: string;
    tenantPurchaseCount: number;
    tenantPurchasesNetAmount: string;
    tenantUnitsPurchased: string;
    utilityFundingLoaded: string;
  };
}

export interface LandlordSubMeterDailyRollupItem {
  cumulativeNetSales: string;
  cumulativeUnitsPurchased: string;
  date: string;
  meter: {
    id: string;
    meterNumber: string;
    meterType: "electricity" | "gas" | "water";
  };
  totals: {
    purchaseCount: number;
    tenantPurchasesNetAmount: string;
    tenantUnitsPurchased: string;
  };
}
