export interface SmsProviderHealthBucket {
  attempted: number;
  delivered: number;
  failed: number;
  failureRate: number;
  pending: number;
}

export interface SmsProviderHealthSummary {
  generatedAt: string;
  hostpinnacle: SmsProviderHealthBucket;
  overall: {
    delivered: number;
    failed: number;
    pending: number;
    total: number;
  };
  textsms: SmsProviderHealthBucket & {
    fallbackUsageRate: number;
    pendingDlrSync: number;
  };
  windowHours: number;
}
