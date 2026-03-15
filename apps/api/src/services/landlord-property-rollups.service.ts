import { and, asc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { meters, motherMeterEvents, transactions } from "../db/schema";
import { buildRollupBucketMeta, getRollupBucketExpression } from "./chart-buckets";
import { toNumber } from "./landlord-dashboard.utils";
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

interface PropertyAccumulator {
  breakdown: {
    postpaid: {
      companyPaymentsToUtility: number;
      motherMetersWithPurchases: Set<string>;
      tenantPurchaseCount: number;
      tenantPurchasesNetAmount: number;
      tenantUnitsPurchased: number;
      utilityFundingLoaded: number;
    };
    prepaid: {
      companyPaymentsToUtility: number;
      motherMetersWithPurchases: Set<string>;
      tenantPurchaseCount: number;
      tenantPurchasesNetAmount: number;
      tenantUnitsPurchased: number;
      utilityFundingLoaded: number;
    };
  };
  companyPaymentsToUtility: number;
  motherMetersWithPurchases: Set<string>;
  tenantPurchaseCount: number;
  tenantPurchasesNetAmount: number;
  tenantUnitsPurchased: number;
  utilityFundingLoaded: number;
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

  const motherMeterIds = scope.motherMeters.map((row) => row.id);
  const motherMeterTypeById = new Map(
    scope.motherMeters.map((row) => [row.id, row.type] as const),
  );
  const baseline = await getPropertyBaseline(motherMeterIds, input.startDate);
  const eventRows = await listPropertyEventBuckets(motherMeterIds, input);
  const purchaseRows = await listPropertyPurchaseBuckets(motherMeterIds, input);
  const rollupMap = new Map<string, PropertyAccumulator>();

  for (const row of eventRows) {
    const current = rollupMap.get(row.bucket) ?? createEmptyAccumulator();
    current.companyPaymentsToUtility += toNumber(row.companyPaymentsToUtility);
    current.utilityFundingLoaded += toNumber(row.utilityFundingLoaded);
    const motherMeterType = motherMeterTypeById.get(row.motherMeterId);
    if (motherMeterType) {
      current.breakdown[motherMeterType].companyPaymentsToUtility += toNumber(
        row.companyPaymentsToUtility,
      );
      current.breakdown[motherMeterType].utilityFundingLoaded += toNumber(
        row.utilityFundingLoaded,
      );
    }
    rollupMap.set(row.bucket, current);
  }

  for (const row of purchaseRows) {
    const current = rollupMap.get(row.bucket) ?? createEmptyAccumulator();
    current.motherMetersWithPurchases.add(row.motherMeterId);
    current.tenantPurchaseCount += row.tenantPurchaseCount;
    current.tenantPurchasesNetAmount += toNumber(row.tenantPurchasesNetAmount);
    current.tenantUnitsPurchased += toNumber(row.tenantUnitsPurchased);
    const motherMeterType = motherMeterTypeById.get(row.motherMeterId);
    if (motherMeterType) {
      current.breakdown[motherMeterType].motherMetersWithPurchases.add(
        row.motherMeterId,
      );
      current.breakdown[motherMeterType].tenantPurchaseCount +=
        row.tenantPurchaseCount;
      current.breakdown[motherMeterType].tenantPurchasesNetAmount += toNumber(
        row.tenantPurchasesNetAmount,
      );
      current.breakdown[motherMeterType].tenantUnitsPurchased += toNumber(
        row.tenantUnitsPurchased,
      );
    }
    rollupMap.set(row.bucket, current);
  }

  let runningCompanyPayments = baseline.companyPaymentsToUtility;
  let runningNetSales = baseline.tenantPurchasesNetAmount;
  let runningUtilityFunding = baseline.utilityFundingLoaded;

  return [...rollupMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? 60))
    .map(([bucket, totals]) => {
      runningCompanyPayments += totals.companyPaymentsToUtility;
      runningNetSales += totals.tenantPurchasesNetAmount;
      runningUtilityFunding += totals.utilityFundingLoaded;
      const prepaidEstimatedBalance =
        runningUtilityFunding - runningCompanyPayments - runningNetSales;
      const postpaidOutstandingAmount = Math.max(
        runningNetSales - runningCompanyPayments,
        0,
      );

      return {
        bucket,
        bucketMeta: buildRollupBucketMeta(bucket, input.granularity),
        breakdown: {
          postpaid: {
            companyPaymentsToUtility:
              totals.breakdown.postpaid.companyPaymentsToUtility.toFixed(2),
            motherMeterCount:
              totals.breakdown.postpaid.motherMetersWithPurchases.size,
            tenantPurchaseCount: totals.breakdown.postpaid.tenantPurchaseCount,
            tenantPurchasesNetAmount:
              totals.breakdown.postpaid.tenantPurchasesNetAmount.toFixed(2),
            tenantUnitsPurchased:
              totals.breakdown.postpaid.tenantUnitsPurchased.toFixed(4),
            utilityFundingLoaded:
              totals.breakdown.postpaid.utilityFundingLoaded.toFixed(2),
          },
          prepaid: {
            companyPaymentsToUtility:
              totals.breakdown.prepaid.companyPaymentsToUtility.toFixed(2),
            motherMeterCount:
              totals.breakdown.prepaid.motherMetersWithPurchases.size,
            tenantPurchaseCount: totals.breakdown.prepaid.tenantPurchaseCount,
            tenantPurchasesNetAmount:
              totals.breakdown.prepaid.tenantPurchasesNetAmount.toFixed(2),
            tenantUnitsPurchased:
              totals.breakdown.prepaid.tenantUnitsPurchased.toFixed(4),
            utilityFundingLoaded:
              totals.breakdown.prepaid.utilityFundingLoaded.toFixed(2),
          },
        },
        financialSnapshot: {
          companyPaymentsToUtility: runningCompanyPayments.toFixed(2),
          netSalesCollected: runningNetSales.toFixed(2),
          postpaidOutstandingAmount: postpaidOutstandingAmount.toFixed(2),
          prepaidEstimatedBalance: prepaidEstimatedBalance.toFixed(2),
          utilityFundingLoaded: runningUtilityFunding.toFixed(2),
        },
        granularity: input.granularity,
        motherMeterType: input.motherMeterType ?? null,
        property: {
          id: propertyId,
        },
        totals: {
          companyPaymentsToUtility: totals.companyPaymentsToUtility.toFixed(2),
          motherMetersWithPurchases: totals.motherMetersWithPurchases.size,
          tenantPurchaseCount: totals.tenantPurchaseCount,
          tenantPurchasesNetAmount: totals.tenantPurchasesNetAmount.toFixed(2),
          tenantUnitsPurchased: totals.tenantUnitsPurchased.toFixed(4),
          utilityFundingLoaded: totals.utilityFundingLoaded.toFixed(2),
        },
      };
    })
    .reverse();
}

async function getPropertyBaseline(motherMeterIds: string[], startDate?: string) {
  if (!startDate) {
    return createEmptyAccumulator();
  }

  const beforeStart = new Date(`${startDate}T00:00:00.000Z`);
  const [eventRows, purchaseRows] = await Promise.all([
    db
      .select({
        companyPaymentsToUtility:
          sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} = 'bill_payment' then ${motherMeterEvents.amount}::numeric else 0 end), 0)::text`,
        utilityFundingLoaded:
          sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} in ('initial_deposit', 'refill') then ${motherMeterEvents.amount}::numeric else 0 end), 0)::text`,
      })
      .from(motherMeterEvents)
      .where(
        and(
          inArray(motherMeterEvents.motherMeterId, motherMeterIds),
          lt(motherMeterEvents.createdAt, beforeStart),
        ),
      )
      .limit(1),
    db
      .select({
        tenantPurchasesNetAmount:
          sql<string>`coalesce(sum(${transactions.netAmount}::numeric), 0)::text`,
      })
      .from(transactions)
      .innerJoin(meters, eq(transactions.meterId, meters.id))
      .where(
        and(
          inArray(meters.motherMeterId, motherMeterIds),
          eq(transactions.status, "completed"),
          lt(transactions.completedAt, beforeStart),
        ),
      )
      .limit(1),
  ]);

  return {
    companyPaymentsToUtility: toNumber(eventRows[0]?.companyPaymentsToUtility),
    motherMetersWithPurchases: new Set<string>(),
    tenantPurchaseCount: 0,
    tenantPurchasesNetAmount: toNumber(purchaseRows[0]?.tenantPurchasesNetAmount),
    tenantUnitsPurchased: 0,
    utilityFundingLoaded: toNumber(eventRows[0]?.utilityFundingLoaded),
  };
}

async function listPropertyEventBuckets(
  motherMeterIds: string[],
  input: PropertyRollupInput,
) {
  const bucketExpr = getRollupBucketExpression(
    motherMeterEvents.createdAt,
    input.granularity,
  );
  const filters = [inArray(motherMeterEvents.motherMeterId, motherMeterIds)];
  if (input.startDate) {
    filters.push(gte(motherMeterEvents.createdAt, new Date(input.startDate)));
  }
  if (input.endDate) {
    filters.push(lte(motherMeterEvents.createdAt, new Date(input.endDate)));
  }

  return db
    .select({
      bucket: bucketExpr,
      companyPaymentsToUtility:
        sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} = 'bill_payment' then ${motherMeterEvents.amount}::numeric else 0 end), 0)::text`,
      motherMeterId: motherMeterEvents.motherMeterId,
      utilityFundingLoaded:
        sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} in ('initial_deposit', 'refill') then ${motherMeterEvents.amount}::numeric else 0 end), 0)::text`,
    })
    .from(motherMeterEvents)
    .where(and(...filters))
    .groupBy(bucketExpr, motherMeterEvents.motherMeterId)
    .orderBy(asc(bucketExpr), motherMeterEvents.motherMeterId);
}

async function listPropertyPurchaseBuckets(
  motherMeterIds: string[],
  input: PropertyRollupInput,
) {
  const bucketExpr = getRollupBucketExpression(
    transactions.completedAt,
    input.granularity,
  );
  const filters = [inArray(meters.motherMeterId, motherMeterIds), eq(transactions.status, "completed")];
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
        sql<string>`coalesce(sum(${transactions.netAmount}::numeric), 0)::text`,
      tenantUnitsPurchased:
        sql<string>`coalesce(sum(${transactions.unitsPurchased}::numeric), 0)::text`,
    })
    .from(transactions)
    .innerJoin(meters, eq(transactions.meterId, meters.id))
    .where(and(...filters))
    .groupBy(bucketExpr, meters.motherMeterId)
    .orderBy(asc(bucketExpr), meters.motherMeterId);
}

function createEmptyAccumulator(): PropertyAccumulator {
  return {
    breakdown: {
      postpaid: {
        companyPaymentsToUtility: 0,
        motherMetersWithPurchases: new Set<string>(),
        tenantPurchaseCount: 0,
        tenantPurchasesNetAmount: 0,
        tenantUnitsPurchased: 0,
        utilityFundingLoaded: 0,
      },
      prepaid: {
        companyPaymentsToUtility: 0,
        motherMetersWithPurchases: new Set<string>(),
        tenantPurchaseCount: 0,
        tenantPurchasesNetAmount: 0,
        tenantUnitsPurchased: 0,
        utilityFundingLoaded: 0,
      },
    },
    companyPaymentsToUtility: 0,
    motherMetersWithPurchases: new Set<string>(),
    tenantPurchaseCount: 0,
    tenantPurchasesNetAmount: 0,
    tenantUnitsPurchased: 0,
    utilityFundingLoaded: 0,
  };
}
