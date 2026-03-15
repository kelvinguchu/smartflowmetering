import type { RollupBucketMeta, RollupGranularity } from "./chart-buckets";

export interface LandlordPropertyAnalyticsTotals {
  companyPaymentsToUtility: string;
  motherMeterCount: number;
  tenantPurchaseCount: number;
  tenantPurchasesNetAmount: string;
  tenantUnitsPurchased: string;
  utilityFundingLoaded: string;
}

export interface LandlordPropertyAnalyticsResponseBreakdown {
  postpaid: LandlordPropertyAnalyticsTotals;
  prepaid: LandlordPropertyAnalyticsTotals;
}

export interface LandlordPropertyRollupItem {
  bucket: string;
  bucketMeta: RollupBucketMeta;
  breakdown: LandlordPropertyAnalyticsResponseBreakdown;
  financialSnapshot: {
    companyPaymentsToUtility: string;
    netSalesCollected: string;
    postpaidOutstandingAmount: string;
    prepaidEstimatedBalance: string;
    utilityFundingLoaded: string;
  };
  granularity: RollupGranularity;
  motherMeterType: "postpaid" | "prepaid" | null;
  property: {
    id: string;
  };
  totals: {
    companyPaymentsToUtility: string;
    motherMetersWithPurchases: number;
    tenantPurchaseCount: number;
    tenantPurchasesNetAmount: string;
    tenantUnitsPurchased: string;
    utilityFundingLoaded: string;
  };
}

export interface LandlordPropertyAnalyticsSummary {
  breakdown: LandlordPropertyAnalyticsResponseBreakdown;
  motherMeterCounts: {
    postpaid: number;
    prepaid: number;
    total: number;
  };
  motherMeterType: "postpaid" | "prepaid" | null;
  property: {
    id: string;
  };
  totals: Omit<LandlordPropertyAnalyticsTotals, "motherMeterCount">;
}

export interface LandlordPropertyMotherMeterComparisonItem {
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
  motherMeterType: "postpaid" | "prepaid" | null;
  totals: {
    companyPaymentsToUtility: string;
    tenantPurchaseCount: number;
    tenantPurchasesNetAmount: string;
    tenantUnitsPurchased: string;
    utilityFundingLoaded: string;
  };
}
