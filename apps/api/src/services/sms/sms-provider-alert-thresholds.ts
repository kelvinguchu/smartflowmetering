export interface SmsProviderAlertThresholds {
  dedupeWindowHours: number;
  hostpinnacleFailureRatePercent: number;
  minFailedCount: number;
  textsmsFallbackUsageRatePercent: number;
  textsmsPendingDlrThreshold: number;
  windowHours: number;
}

export const DEFAULT_SMS_PROVIDER_ALERT_THRESHOLDS: SmsProviderAlertThresholds =
  {
    dedupeWindowHours: 6,
    hostpinnacleFailureRatePercent: 40,
    minFailedCount: 5,
    textsmsFallbackUsageRatePercent: 20,
    textsmsPendingDlrThreshold: 10,
    windowHours: 1,
  };

export function resolveSmsProviderAlertThresholds(
  input: Partial<SmsProviderAlertThresholds> = {},
): SmsProviderAlertThresholds {
  return {
    dedupeWindowHours:
      input.dedupeWindowHours ??
      DEFAULT_SMS_PROVIDER_ALERT_THRESHOLDS.dedupeWindowHours,
    hostpinnacleFailureRatePercent:
      input.hostpinnacleFailureRatePercent ??
      DEFAULT_SMS_PROVIDER_ALERT_THRESHOLDS.hostpinnacleFailureRatePercent,
    minFailedCount:
      input.minFailedCount ??
      DEFAULT_SMS_PROVIDER_ALERT_THRESHOLDS.minFailedCount,
    textsmsFallbackUsageRatePercent:
      input.textsmsFallbackUsageRatePercent ??
      DEFAULT_SMS_PROVIDER_ALERT_THRESHOLDS.textsmsFallbackUsageRatePercent,
    textsmsPendingDlrThreshold:
      input.textsmsPendingDlrThreshold ??
      DEFAULT_SMS_PROVIDER_ALERT_THRESHOLDS.textsmsPendingDlrThreshold,
    windowHours:
      input.windowHours ?? DEFAULT_SMS_PROVIDER_ALERT_THRESHOLDS.windowHours,
  };
}
