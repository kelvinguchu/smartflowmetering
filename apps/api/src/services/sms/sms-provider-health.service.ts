import { and, gte, isNull, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { smsLogs } from "../../db/schema";
import type {
  SmsProviderHealthBucket,
  SmsProviderHealthSignal,
  SmsProviderHealthSummary,
} from "./sms-provider-health.types";
import { DEFAULT_SMS_PROVIDER_ALERT_THRESHOLDS } from "./sms-provider-alert-thresholds";

interface ProviderStatsRow {
  attempted: number;
  delivered: number;
  failed: number;
  pending: number;
  provider: "hostpinnacle" | "textsms";
}

export async function getSmsProviderHealthSummary(
  windowHours: number,
): Promise<SmsProviderHealthSummary> {
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const [providerRows, textsmsPendingDlr] = await Promise.all([
    loadProviderStats(windowStart),
    loadTextSmsPendingDlrMetrics(windowStart),
  ]);

  const hostpinnacle = toBucket(
    providerRows.find((row) => row.provider === "hostpinnacle") ?? null,
  );
  const textsmsBase = toBucket(
    providerRows.find((row) => row.provider === "textsms") ?? null,
  );

  const totalAttempted = hostpinnacle.attempted + textsmsBase.attempted;
  const oldestPendingDlrCreatedAt = toOptionalDate(
    textsmsPendingDlr.oldestCreatedAt,
  );
  const fallbackUsageRate =
    totalAttempted === 0
      ? 0
      : roundPercentage((textsmsBase.attempted / totalAttempted) * 100);
  const oldestPendingDlrAgeMinutes =
    oldestPendingDlrCreatedAt === null
      ? null
      : Math.max(
          0,
          Math.round(
            (Date.now() - oldestPendingDlrCreatedAt.getTime()) / (60 * 1000),
          ),
        );

  return {
    generatedAt: new Date().toISOString(),
    hostpinnacle,
    overall: {
      delivered: hostpinnacle.delivered + textsmsBase.delivered,
      failed: hostpinnacle.failed + textsmsBase.failed,
      pending: hostpinnacle.pending + textsmsBase.pending,
      total: totalAttempted,
    },
    signals: {
      hostpinnacle: buildHostpinnacleSignal(hostpinnacle),
      textsmsDlrBacklog: buildTextSmsDlrSignal(
        textsmsPendingDlr.count,
        oldestPendingDlrAgeMinutes,
      ),
      textsmsFallback: buildTextSmsFallbackSignal(
        fallbackUsageRate,
        totalAttempted,
      ),
    },
    textsms: {
      ...textsmsBase,
      fallbackUsageRate,
      oldestPendingDlrAgeMinutes,
      pendingDlrSync: textsmsPendingDlr.count,
    },
    windowHours,
  };
}

async function loadProviderStats(
  windowStart: Date,
): Promise<ProviderStatsRow[]> {
  return db
    .select({
      attempted: sql<number>`count(*)::int`,
      delivered: sql<number>`count(*) filter (where ${smsLogs.status} = 'delivered')::int`,
      failed: sql<number>`count(*) filter (where ${smsLogs.status} = 'failed')::int`,
      pending: sql<number>`count(*) filter (where ${smsLogs.status} in ('queued', 'sent'))::int`,
      provider: smsLogs.provider,
    })
    .from(smsLogs)
    .where(gte(smsLogs.createdAt, windowStart))
    .groupBy(smsLogs.provider);
}

async function loadTextSmsPendingDlrMetrics(windowStart: Date): Promise<{
  count: number;
  oldestCreatedAt: Date | string | null;
}> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      oldestCreatedAt: sql<Date | null>`min(${smsLogs.createdAt})`,
    })
    .from(smsLogs)
    .where(
      and(
        gte(smsLogs.createdAt, windowStart),
        sql`${smsLogs.provider} = 'textsms'`,
        sql`${smsLogs.status} = 'sent'`,
        isNull(smsLogs.providerDeliveredAt),
        or(
          isNull(smsLogs.providerStatus),
          sql`${smsLogs.providerStatus} <> 'Delivered'`,
        ),
      ),
    );

  return {
    count: row.count,
    oldestCreatedAt: row.oldestCreatedAt,
  };
}

function toBucket(row: ProviderStatsRow | null): SmsProviderHealthBucket {
  if (row === null) {
    return {
      attempted: 0,
      delivered: 0,
      failed: 0,
      failureRate: 0,
      pending: 0,
    };
  }

  return {
    attempted: row.attempted,
    delivered: row.delivered,
    failed: row.failed,
    failureRate:
      row.attempted === 0
        ? 0
        : roundPercentage((row.failed / row.attempted) * 100),
    pending: row.pending,
  };
}

function roundPercentage(value: number): number {
  return Math.round(value * 100) / 100;
}

function toOptionalDate(value: Date | string | null): Date | null {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildHostpinnacleSignal(
  bucket: SmsProviderHealthBucket,
): SmsProviderHealthSignal {
  if (
    bucket.failed >= DEFAULT_SMS_PROVIDER_ALERT_THRESHOLDS.minFailedCount &&
    bucket.failureRate >=
      DEFAULT_SMS_PROVIDER_ALERT_THRESHOLDS.hostpinnacleFailureRatePercent
  ) {
    return {
      level: "critical",
      recommendedAction:
        "Treat HostPinnacle as degraded, review recent provider errors, and confirm TextSMS fallback is carrying delivery load.",
      summary:
        "HostPinnacle failure volume is above the outage threshold for the current review window.",
    };
  }

  return {
    level: "healthy",
    recommendedAction: null,
    summary: "HostPinnacle failure volume is below the outage threshold.",
  };
}

function buildTextSmsFallbackSignal(
  fallbackUsageRate: number,
  totalAttempted: number,
): SmsProviderHealthSignal {
  if (
    totalAttempted > 0 &&
    fallbackUsageRate >=
      DEFAULT_SMS_PROVIDER_ALERT_THRESHOLDS.textsmsFallbackUsageRatePercent
  ) {
    return {
      level: "warning",
      recommendedAction:
        "Review why HostPinnacle traffic is spilling to TextSMS and confirm fallback remains intentional rather than permanent routing drift.",
      summary: "TextSMS is handling an elevated share of recent SMS traffic.",
    };
  }

  return {
    level: "healthy",
    recommendedAction: null,
    summary: "TextSMS fallback usage is within the normal operating range.",
  };
}

function buildTextSmsDlrSignal(
  pendingDlrSync: number,
  oldestPendingDlrAgeMinutes: number | null,
): SmsProviderHealthSignal {
  if (
    pendingDlrSync >=
    DEFAULT_SMS_PROVIDER_ALERT_THRESHOLDS.textsmsPendingDlrThreshold
  ) {
    const ageDetail =
      oldestPendingDlrAgeMinutes === null
        ? ""
        : ` Oldest pending delivery report is ${oldestPendingDlrAgeMinutes} minute(s) old.`;

    return {
      level: "warning",
      recommendedAction:
        "Run or inspect TextSMS delivery-report sync before retrying customer delivery, then clear or document the backlog.",
      summary: `TextSMS delivery-report backlog is above the review threshold.${ageDetail}`,
    };
  }

  return {
    level: "healthy",
    recommendedAction: null,
    summary:
      "TextSMS delivery-report backlog is within the normal review threshold.",
  };
}


