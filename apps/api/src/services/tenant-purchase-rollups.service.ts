import { and, asc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { transactions } from "../db/schema";
import {
  buildRollupBucketMeta,
  getRollupBucketExpression,
} from "./chart-buckets";
import type { RollupGranularity } from "./chart-buckets";
import { toNumber } from "./landlord-dashboard.utils";
import type { TenantAccessSummary } from "./tenant-access.types";
import type { TenantPurchaseRollupItem } from "./tenant-purchase-rollups.types";

interface RollupInput {
  endDate?: string;
  granularity: RollupGranularity;
  limit?: number;
  offset?: number;
  startDate?: string;
}

export async function listTenantPurchaseRollups(
  tenantAccess: TenantAccessSummary,
  input: RollupInput,
): Promise<TenantPurchaseRollupItem[]> {
  const baseline = await getTenantBaseline(tenantAccess.meterId, input.startDate);
  const dayRows = await listTenantPurchaseDays(tenantAccess.meterId, input);
  let cumulativeMeterCreditAmount = baseline.cumulativeMeterCreditAmount;
  let cumulativeUnitsPurchased = baseline.cumulativeUnitsPurchased;

  return dayRows
    .slice(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? 60))
    .map((row) => {
      cumulativeMeterCreditAmount += toNumber(row.meterCreditAmount);
      cumulativeUnitsPurchased += toNumber(row.unitsPurchased);
      return {
        bucket: row.bucket,
        bucketMeta: buildRollupBucketMeta(row.bucket, input.granularity),
        cumulativeMeterCreditAmount: cumulativeMeterCreditAmount.toFixed(2),
        cumulativeUnitsPurchased: cumulativeUnitsPurchased.toFixed(4),
        granularity: input.granularity,
        totals: {
          meterCreditAmount: toNumber(row.meterCreditAmount).toFixed(2),
          purchaseCount: row.purchaseCount,
          unitsPurchased: toNumber(row.unitsPurchased).toFixed(4),
        },
      };
    })
    .reverse();
}

async function getTenantBaseline(meterId: string, startDate?: string) {
  if (!startDate) {
    return {
      cumulativeMeterCreditAmount: 0,
      cumulativeUnitsPurchased: 0,
    };
  }

  const beforeStart = new Date(`${startDate}T00:00:00.000Z`);
  const rows = await db
    .select({
      cumulativeMeterCreditAmount:
        sql<string>`coalesce(sum(${transactions.netAmount}::numeric), 0)::text`,
      cumulativeUnitsPurchased:
        sql<string>`coalesce(sum(${transactions.unitsPurchased}::numeric), 0)::text`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.meterId, meterId),
        eq(transactions.status, "completed"),
        lt(transactions.completedAt, beforeStart),
      ),
    )
    .limit(1);

  return {
    cumulativeMeterCreditAmount: toNumber(rows[0]?.cumulativeMeterCreditAmount),
    cumulativeUnitsPurchased: toNumber(rows[0]?.cumulativeUnitsPurchased),
  };
}

async function listTenantPurchaseDays(meterId: string, input: RollupInput) {
  const bucketExpr = getRollupBucketExpression(
    transactions.completedAt,
    input.granularity,
  );
  const filters = [eq(transactions.meterId, meterId), eq(transactions.status, "completed")];
  if (input.startDate) {
    filters.push(gte(transactions.completedAt, new Date(input.startDate)));
  }
  if (input.endDate) {
    filters.push(lte(transactions.completedAt, new Date(input.endDate)));
  }

  return db
    .select({
      bucket: bucketExpr,
      meterCreditAmount:
        sql<string>`coalesce(sum(${transactions.netAmount}::numeric), 0)::text`,
      purchaseCount: sql<number>`count(${transactions.id})::int`,
      unitsPurchased:
        sql<string>`coalesce(sum(${transactions.unitsPurchased}::numeric), 0)::text`,
    })
    .from(transactions)
    .where(and(...filters))
    .groupBy(bucketExpr)
    .orderBy(asc(bucketExpr));
}
