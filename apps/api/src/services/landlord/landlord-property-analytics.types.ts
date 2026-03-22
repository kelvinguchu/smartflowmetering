import type { RollupBucketMeta, RollupGranularity } from "../chart-buckets";

export interface LandlordPropertyAnalyticsTotals {
  motherMeterCount: number;
  tenantPurchaseCount: number;
  tenantPurchasesNetAmount: string;
  tenantUnitsPurchased: string;
}

export interface LandlordPropertyAnalyticsResponseBreakdown {
  postpaid: LandlordPropertyAnalyticsTotals;
  prepaid: LandlordPropertyAnalyticsTotals;
}

export interface LandlordPropertyRollupItem {
  bucket: string;
  bucketMeta: RollupBucketMeta;
  breakdown: LandlordPropertyAnalyticsResponseBreakdown;
  granularity: RollupGranularity;
  motherMeterType: "postpaid" | "prepaid" | null;
  totals: {
    motherMetersWithPurchases: number;
    tenantPurchaseCount: number;
    tenantPurchasesNetAmount: string;
    tenantUnitsPurchased: string;
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
  totals: Omit<LandlordPropertyAnalyticsTotals, "motherMeterCount">;
}

export interface LandlordPropertyMotherMeterComparisonItem {
  motherMeter: {
    motherMeterNumber: string;
    type: "postpaid" | "prepaid";
  };
  motherMeterType: "postpaid" | "prepaid" | null;
  totals: {
    tenantPurchaseCount: number;
    tenantPurchasesNetAmount: string;
    tenantUnitsPurchased: string;
  };
}
