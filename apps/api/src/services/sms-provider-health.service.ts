import { and, gte, isNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import { smsLogs } from "../db/schema";
import type {
  SmsProviderHealthBucket,
  SmsProviderHealthSummary,
} from "./sms-provider-health.types";

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
    loadTextSmsPendingDlrCount(windowStart),
  ]);

  const hostpinnacle = toBucket(
    providerRows.find((row) => row.provider === "hostpinnacle") ?? null,
  );
  const textsmsBase = toBucket(
    providerRows.find((row) => row.provider === "textsms") ?? null,
  );

  const totalAttempted = hostpinnacle.attempted + textsmsBase.attempted;

  return {
    generatedAt: new Date().toISOString(),
    hostpinnacle,
    overall: {
      delivered: hostpinnacle.delivered + textsmsBase.delivered,
      failed: hostpinnacle.failed + textsmsBase.failed,
      pending: hostpinnacle.pending + textsmsBase.pending,
      total: totalAttempted,
    },
    textsms: {
      ...textsmsBase,
      fallbackUsageRate:
        totalAttempted === 0
          ? 0
          : roundPercentage((textsmsBase.attempted / totalAttempted) * 100),
      pendingDlrSync: textsmsPendingDlr,
    },
    windowHours,
  };
}

async function loadProviderStats(windowStart: Date): Promise<ProviderStatsRow[]> {
  return db
    .select({
      attempted: sql<number>`count(*)::int`,
      delivered:
        sql<number>`count(*) filter (where ${smsLogs.status} = 'delivered')::int`,
      failed: sql<number>`count(*) filter (where ${smsLogs.status} = 'failed')::int`,
      pending:
        sql<number>`count(*) filter (where ${smsLogs.status} in ('queued', 'sent'))::int`,
      provider: smsLogs.provider,
    })
    .from(smsLogs)
    .where(gte(smsLogs.createdAt, windowStart))
    .groupBy(smsLogs.provider);
}

async function loadTextSmsPendingDlrCount(windowStart: Date): Promise<number> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(smsLogs)
    .where(
      and(
        gte(smsLogs.createdAt, windowStart),
        sql`${smsLogs.provider} = 'textsms'`,
        sql`${smsLogs.status} = 'sent'`,
        isNull(smsLogs.providerDeliveredAt),
        or(isNull(smsLogs.providerStatus), sql`${smsLogs.providerStatus} <> 'Delivered'`),
      ),
    );

  return row.count;
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
      row.attempted === 0 ? 0 : roundPercentage((row.failed / row.attempted) * 100),
    pending: row.pending,
  };
}

function roundPercentage(value: number): number {
  return Math.round(value * 100) / 100;
}
