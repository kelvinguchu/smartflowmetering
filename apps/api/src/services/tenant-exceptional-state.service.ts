import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  customerAppNotifications,
  meters,
  motherMeters,
  properties,
  transactions,
} from "../db/schema";
import { revealToken } from "../lib/token-protection";
import { maskToken } from "../lib/token-redaction";
import { toNumber } from "./landlord-dashboard.utils";
import type { TenantAccessSummary } from "./tenant-access.types";
import type {
  TenantExceptionalStateItem,
  TenantExceptionalStateResponse,
} from "./tenant-exceptional-state.types";
import { findLatestTenantCreditToken } from "./tenant-token.utils";

const PENDING_TOKEN_THRESHOLD_MINUTES = 15;
const TOKEN_UNACKNOWLEDGED_THRESHOLD_MINUTES = 60;
const TOKEN_LOOKBACK_DAYS = 30;
const TOKEN_STATE_SCAN_LIMIT = 50;

interface TenantExceptionalStateRecord {
  completedAt: Date | null;
  generatedTokens: {
    createdAt: Date;
    token: string;
    tokenType:
      | "clear_credit"
      | "clear_tamper"
      | "credit"
      | "key_change"
      | "set_power_limit";
  }[];
  netAmount: string;
  mpesaReceiptNumber: string;
  transactionId: string;
  unitsPurchased: string;
}

export async function getTenantExceptionalState(
  tenantAccess: TenantAccessSummary,
): Promise<TenantExceptionalStateResponse> {
  const [meterRow, transactionRows] = await Promise.all([
    loadTenantMeterState(tenantAccess),
    loadTenantExceptionalTransactionRows(tenantAccess),
  ]);

  const notificationStatuses = await loadTenantTokenNotificationStatuses(
    tenantAccess.id,
    transactionRows.map((row) => row.transactionId),
  );

  const items: TenantExceptionalStateItem[] = [];
  if (meterRow.status === "inactive" || meterRow.status === "suspended") {
    const minutesSinceStatusChange = diffInWholeMinutes(meterRow.updatedAt);
    items.push({
      detectedAt: meterRow.updatedAt.toISOString(),
      minutesSinceStatusChange,
      severity: "critical",
      status: meterRow.status,
      type: meterRow.status === "inactive" ? "meter_inactive" : "meter_suspended",
    });
  }

  for (const row of transactionRows) {
    if (row.completedAt === null) {
      continue;
    }
    const latestCreditToken = findLatestTenantCreditToken(row.generatedTokens);
    if (latestCreditToken === null) {
      const minutesSinceCompletion = diffInWholeMinutes(row.completedAt);
      if (minutesSinceCompletion >= PENDING_TOKEN_THRESHOLD_MINUTES) {
        items.push({
          completedAt: row.completedAt.toISOString(),
          detectedAt: row.completedAt.toISOString(),
          meterCreditAmount: toNumber(row.netAmount).toFixed(2),
          minutesSinceCompletion,
          mpesaReceiptNumber: row.mpesaReceiptNumber,
          severity: "warning",
          transactionId: row.transactionId,
          type: "token_pending_generation",
          unitsPurchased: toNumber(row.unitsPurchased).toFixed(4),
        });
      }
      continue;
    }

    const notificationStatus =
      notificationStatuses.get(row.transactionId) ?? "missing";
    const minutesSinceTokenGenerated = diffInWholeMinutes(
      latestCreditToken.createdAt,
    );
    if (notificationStatus === "read" || notificationStatus === "failed") {
      continue;
    }
    if (minutesSinceTokenGenerated < TOKEN_UNACKNOWLEDGED_THRESHOLD_MINUTES) {
      continue;
    }

    items.push({
      appNotificationStatus: notificationStatus,
      completedAt: row.completedAt.toISOString(),
      detectedAt: latestCreditToken.createdAt.toISOString(),
      maskedToken: maskToken(revealToken(latestCreditToken.token)),
      meterCreditAmount: toNumber(row.netAmount).toFixed(2),
      minutesSinceTokenGenerated,
      mpesaReceiptNumber: row.mpesaReceiptNumber,
      severity: "warning",
      tokenGeneratedAt: latestCreditToken.createdAt.toISOString(),
      transactionId: row.transactionId,
      type: "token_available_unacknowledged",
      unitsPurchased: toNumber(row.unitsPurchased).toFixed(4),
    });
  }

  const sortedItems = items.sort((left, right) => {
    if (left.severity !== right.severity) {
      return left.severity === "critical" ? -1 : 1;
    }
    return right.detectedAt.localeCompare(left.detectedAt);
  });

  return {
    data: sortedItems,
    meter: {
      id: meterRow.id,
      meterNumber: meterRow.meterNumber,
      status: meterRow.status,
    },
    summary: {
      criticalCount: sortedItems.filter((item) => item.severity === "critical")
        .length,
      count: sortedItems.length,
      warningCount: sortedItems.filter((item) => item.severity === "warning")
        .length,
    },
    thresholds: {
      pendingTokenMinutes: PENDING_TOKEN_THRESHOLD_MINUTES,
      unacknowledgedTokenMinutes: TOKEN_UNACKNOWLEDGED_THRESHOLD_MINUTES,
    },
  };
}

async function loadTenantMeterState(tenantAccess: TenantAccessSummary) {
  const rows = await db
    .select({
      id: meters.id,
      meterNumber: meters.meterNumber,
      status: meters.status,
      updatedAt: meters.updatedAt,
    })
    .from(meters)
    .innerJoin(motherMeters, eq(meters.motherMeterId, motherMeters.id))
    .innerJoin(properties, eq(motherMeters.propertyId, properties.id))
    .where(eq(meters.id, tenantAccess.meterId))
    .limit(1);

  return rows[0];
}

async function loadTenantExceptionalTransactionRows(
  tenantAccess: TenantAccessSummary,
): Promise<TenantExceptionalStateRecord[]> {
  const lookback = new Date(Date.now() - TOKEN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  return (await db.query.transactions.findMany({
    where: and(
      eq(transactions.meterId, tenantAccess.meterId),
      eq(transactions.status, "completed"),
      gte(transactions.completedAt, lookback),
    ),
    columns: {
      completedAt: true,
      mpesaReceiptNumber: true,
      netAmount: true,
      transactionId: true,
      unitsPurchased: true,
    },
    with: {
      generatedTokens: {
        columns: {
          createdAt: true,
          token: true,
          tokenType: true,
        },
      },
    },
    orderBy: [desc(transactions.completedAt), desc(transactions.createdAt)],
    limit: TOKEN_STATE_SCAN_LIMIT,
  })) as TenantExceptionalStateRecord[];
}

async function loadTenantTokenNotificationStatuses(
  tenantAccessId: string,
  transactionIds: string[],
) {
  if (transactionIds.length === 0) {
    return new Map<
      string,
      "failed" | "missing" | "pending" | "read" | "sent"
    >();
  }

  const rows = await db
    .select({
      readAt: customerAppNotifications.readAt,
      referenceId: customerAppNotifications.referenceId,
      status: customerAppNotifications.status,
    })
    .from(customerAppNotifications)
    .where(
      and(
        eq(customerAppNotifications.tenantAccessId, tenantAccessId),
        eq(customerAppNotifications.type, "token_delivery_available"),
        inArray(customerAppNotifications.referenceId, transactionIds),
      ),
    );

  return rows.reduce<
    Map<string, "failed" | "missing" | "pending" | "read" | "sent">
  >((map, row) => {
    const status = row.readAt !== null ? "read" : row.status;
    const current = map.get(row.referenceId);
    if (current === "read") {
      return map;
    }
    if (status === "read" || current === undefined) {
      map.set(row.referenceId, status);
    }
    return map;
  }, new Map());
}

function diffInWholeMinutes(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}
