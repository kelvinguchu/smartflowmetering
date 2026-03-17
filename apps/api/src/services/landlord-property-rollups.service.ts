import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { meters, transactions } from "../db/schema";
import { buildRollupBucketMeta, getRollupBucketExpression } from "./chart-buckets";
import { getScopedLandlordPropertyAnalytics } from "./landlord-property-analytics.scope";
import type { LandlordPropertyRollupItem } from "./landlord-property-analytics.types";

interface PropertyRollupInput {
  endDate?: string;
  granularity: "day" | "month" | "week";
  limit?: number;
  motherMeterType?: "postpaid" | "prepaid";
  offset?: number;
  startDate?: string;
}

interface RollupAccumulator {
  breakdown: {
    postpaid: RollupTotals;
    prepaid: RollupTotals;
  };
  motherMetersWithPurchases: Set<string>;
  tenantPurchaseCount: number;
  tenantPurchasesNetAmount: number;
  tenantUnitsPurchased: number;
}

interface RollupTotals {
  motherMetersWithPurchases: Set<string>;
  tenantPurchaseCount: number;
  tenantPurchasesNetAmount: number;
  tenantUnitsPurchased: number;
}

export async function getLandlordPropertyRollups(
  landlordId: string,
  propertyId: string,
  input: PropertyRollupInput,
): Promise<LandlordPropertyRollupItem[] | null> {
  const scope = await getScopedLandlordPropertyAnalytics(
    landlordId,
    propertyId,
    input.motherMeterType,
  );
  if (scope === null) {
    return null;
  }
  if (scope.motherMeters.length === 0) {
    return [];
  }

  const motherMeterTypeById = new Map(
    scope.motherMeters.map((row) => [row.id, row.type] as const),
  );
  const purchaseRows = await listPropertyPurchaseBuckets(
    scope.motherMeters.map((row) => row.id),
    input,
  );
  const rollupMap = new Map<string, RollupAccumulator>();

  for (const row of purchaseRows) {
    const current = rollupMap.get(row.bucket) ?? createEmptyAccumulator();
    current.motherMetersWithPurchases.add(row.motherMeterId);
    current.tenantPurchaseCount += row.tenantPurchaseCount;
    current.tenantPurchasesNetAmount += Number.parseFloat(
      row.tenantPurchasesNetAmount,
    );
    current.tenantUnitsPurchased += Number.parseFloat(row.tenantUnitsPurchased);

    const motherMeterType = motherMeterTypeById.get(row.motherMeterId);
    if (motherMeterType) {
      const breakdown = current.breakdown[motherMeterType];
      breakdown.motherMetersWithPurchases.add(row.motherMeterId);
      breakdown.tenantPurchaseCount += row.tenantPurchaseCount;
      breakdown.tenantPurchasesNetAmount += Number.parseFloat(
        row.tenantPurchasesNetAmount,
      );
      breakdown.tenantUnitsPurchased += Number.parseFloat(row.tenantUnitsPurchased);
    }

    rollupMap.set(row.bucket, current);
  }

  return [...rollupMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? 60))
    .map(([bucket, totals]) => ({
      bucket,
      bucketMeta: buildRollupBucketMeta(bucket, input.granularity),
      breakdown: {
        postpaid: toBreakdownItem(totals.breakdown.postpaid),
        prepaid: toBreakdownItem(totals.breakdown.prepaid),
      },
      granularity: input.granularity,
      motherMeterType: input.motherMeterType ?? null,
      totals: {
        motherMetersWithPurchases: totals.motherMetersWithPurchases.size,
        tenantPurchaseCount: totals.tenantPurchaseCount,
        tenantPurchasesNetAmount: totals.tenantPurchasesNetAmount.toFixed(2),
        tenantUnitsPurchased: totals.tenantUnitsPurchased.toFixed(4),
      },
    }))
    .reverse();
}

async function listPropertyPurchaseBuckets(
  motherMeterIds: string[],
  input: PropertyRollupInput,
) {
  const bucketExpr = getRollupBucketExpression(
    transactions.completedAt,
    input.granularity,
  );
  const filters = [
    inArray(meters.motherMeterId, motherMeterIds),
    eq(transactions.status, "completed"),
  ];
  if (input.startDate) {
    filters.push(gte(transactions.completedAt, new Date(input.startDate)));
  }
  if (input.endDate) {
    filters.push(lte(transactions.completedAt, new Date(input.endDate)));
  }

  return db
    .select({
      bucket: bucketExpr,
      motherMeterId: meters.motherMeterId,
      tenantPurchaseCount: sql<number>`count(${transactions.id})::int`,
      tenantPurchasesNetAmount:
        sql<string>`coalesce(sum(${transactions.netAmount}::numeric), 0)::numeric(12,2)::text`,
      tenantUnitsPurchased:
        sql<string>`coalesce(sum(${transactions.unitsPurchased}::numeric), 0)::numeric(12,4)::text`,
    })
    .from(transactions)
    .innerJoin(meters, eq(transactions.meterId, meters.id))
    .where(and(...filters))
    .groupBy(bucketExpr, meters.motherMeterId)
    .orderBy(asc(bucketExpr), meters.motherMeterId);
}

function createEmptyAccumulator(): RollupAccumulator {
  return {
    breakdown: {
      postpaid: emptyRollupTotals(),
      prepaid: emptyRollupTotals(),
    },
    motherMetersWithPurchases: new Set<string>(),
    tenantPurchaseCount: 0,
    tenantPurchasesNetAmount: 0,
    tenantUnitsPurchased: 0,
  };
}

function emptyRollupTotals(): RollupTotals {
  return {
    motherMetersWithPurchases: new Set<string>(),
    tenantPurchaseCount: 0,
    tenantPurchasesNetAmount: 0,
    tenantUnitsPurchased: 0,
  };
}

function toBreakdownItem(totals: RollupTotals) {
  return {
    motherMeterCount: totals.motherMetersWithPurchases.size,
    tenantPurchaseCount: totals.tenantPurchaseCount,
    tenantPurchasesNetAmount: totals.tenantPurchasesNetAmount.toFixed(2),
    tenantUnitsPurchased: totals.tenantUnitsPurchased.toFixed(4),
  };
}
