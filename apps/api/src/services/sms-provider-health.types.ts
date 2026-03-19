export interface SmsProviderHealthBucket {
  attempted: number;
  delivered: number;
  failed: number;
  failureRate: number;
  pending: number;
}

export interface SmsProviderHealthSignal {
  level: "healthy" | "warning" | "critical";
  recommendedAction: string | null;
  summary: string;
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
  signals: {
    hostpinnacle: SmsProviderHealthSignal;
    textsmsDlrBacklog: SmsProviderHealthSignal;
    textsmsFallback: SmsProviderHealthSignal;
  };
  textsms: SmsProviderHealthBucket & {
    fallbackUsageRate: number;
    oldestPendingDlrAgeMinutes: number | null;
    pendingDlrSync: number;
  };
  windowHours: number;
}
