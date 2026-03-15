import {
  createAdminNotification,
  hasRecentAdminNotification,
} from "./admin-notifications.service";
import { getSmsProviderHealthSummary } from "./sms-provider-health.service";

const DEFAULTS = {
  dedupeWindowHours: 6,
  hostpinnacleFailureRatePercent: 40,
  minFailedCount: 5,
  textsmsFallbackUsageRatePercent: 20,
  textsmsPendingDlrThreshold: 10,
  windowHours: 1,
} as const;

export interface RunSmsProviderAlertsInput {
  dedupeWindowHours?: number;
  hostpinnacleFailureRatePercent?: number;
  minFailedCount?: number;
  textsmsFallbackUsageRatePercent?: number;
  textsmsPendingDlrThreshold?: number;
  windowHours?: number;
}

export async function runSmsProviderAlerts(input: RunSmsProviderAlertsInput) {
  const resolved = {
    dedupeWindowHours: input.dedupeWindowHours ?? DEFAULTS.dedupeWindowHours,
    hostpinnacleFailureRatePercent:
      input.hostpinnacleFailureRatePercent ??
      DEFAULTS.hostpinnacleFailureRatePercent,
    minFailedCount: input.minFailedCount ?? DEFAULTS.minFailedCount,
    textsmsFallbackUsageRatePercent:
      input.textsmsFallbackUsageRatePercent ??
      DEFAULTS.textsmsFallbackUsageRatePercent,
    textsmsPendingDlrThreshold:
      input.textsmsPendingDlrThreshold ?? DEFAULTS.textsmsPendingDlrThreshold,
    windowHours: input.windowHours ?? DEFAULTS.windowHours,
  };

  const summary = await getSmsProviderHealthSummary(resolved.windowHours);
  const created: string[] = [];

  if (
    summary.hostpinnacle.failed >= resolved.minFailedCount &&
    summary.hostpinnacle.failureRate >= resolved.hostpinnacleFailureRatePercent
  ) {
    const entityId = `hostpinnacle-window-${resolved.windowHours}`;
    const exists = await hasRecentAdminNotification({
      type: "sms_provider_outage",
      entityId,
      dedupeWindowHours: resolved.dedupeWindowHours,
    });

    if (!exists) {
      await createAdminNotification({
        type: "sms_provider_outage",
        severity: "critical",
        title: "HostPinnacle SMS failure spike",
        message:
          `HostPinnacle failed ${summary.hostpinnacle.failed} of ` +
          `${summary.hostpinnacle.attempted} SMS attempts in the last ` +
          `${resolved.windowHours} hour(s).`,
        entityId,
        entityType: "sms_provider",
        metadata: {
          failed: summary.hostpinnacle.failed,
          failureRate: summary.hostpinnacle.failureRate,
          provider: "hostpinnacle",
          windowHours: resolved.windowHours,
        },
      });
      created.push(entityId);
    }
  }

  if (summary.textsms.fallbackUsageRate >= resolved.textsmsFallbackUsageRatePercent) {
    const entityId = `textsms-fallback-window-${resolved.windowHours}`;
    const exists = await hasRecentAdminNotification({
      type: "sms_provider_outage",
      entityId,
      dedupeWindowHours: resolved.dedupeWindowHours,
    });

    if (!exists) {
      await createAdminNotification({
        type: "sms_provider_outage",
        severity: "warning",
        title: "TextSMS fallback usage spike",
        message:
          `TextSMS handled ${summary.textsms.attempted} of ${summary.overall.total} ` +
          `SMS attempts in the last ${resolved.windowHours} hour(s).`,
        entityId,
        entityType: "sms_provider",
        metadata: {
          fallbackUsageRate: summary.textsms.fallbackUsageRate,
          provider: "textsms",
          windowHours: resolved.windowHours,
        },
      });
      created.push(entityId);
    }
  }

  if (summary.textsms.pendingDlrSync >= resolved.textsmsPendingDlrThreshold) {
    const entityId = `textsms-dlr-backlog-window-${resolved.windowHours}`;
    const exists = await hasRecentAdminNotification({
      type: "sms_provider_outage",
      entityId,
      dedupeWindowHours: resolved.dedupeWindowHours,
    });

    if (!exists) {
      await createAdminNotification({
        type: "sms_provider_outage",
        severity: "warning",
        title: "TextSMS delivery sync backlog",
        message:
          `There are ${summary.textsms.pendingDlrSync} TextSMS messages still ` +
          `waiting for delivery confirmation in the last ${resolved.windowHours} hour(s).`,
        entityId,
        entityType: "sms_provider",
        metadata: {
          pendingDlrSync: summary.textsms.pendingDlrSync,
          provider: "textsms",
          windowHours: resolved.windowHours,
        },
      });
      created.push(entityId);
    }
  }

  return {
    created,
    createdCount: created.length,
    summary,
    thresholds: resolved,
  };
}
