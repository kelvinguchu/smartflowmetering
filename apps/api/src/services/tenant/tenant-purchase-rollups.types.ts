import type { RollupBucketMeta, RollupGranularity } from "../chart-buckets";

export interface TenantPurchaseRollupItem {
  bucket: string;
  bucketMeta: RollupBucketMeta;
  cumulativeMeterCreditAmount: string;
  cumulativeUnitsPurchased: string;
  granularity: RollupGranularity;
  totals: {
    meterCreditAmount: string;
    purchaseCount: number;
    unitsPurchased: string;
  };
}
