import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { meters, transactions } from "../db/schema";
import { getScopedLandlordPropertyAnalytics } from "./landlord-property-analytics.scope";
import type { LandlordPropertyAnalyticsSummary } from "./landlord-property-analytics.types";

interface PropertyAnalyticsSummaryInput {
  endDate?: string;
  motherMeterType?: "postpaid" | "prepaid";
  startDate?: string;
}

export async function getLandlordPropertyAnalyticsSummary(
  landlordId: string,
  propertyId: string,
  input: PropertyAnalyticsSummaryInput,
): Promise<LandlordPropertyAnalyticsSummary | null> {
  const scope = await getScopedLandlordPropertyAnalytics(
    landlordId,
    propertyId,
    input.motherMeterType,
  );
  if (scope === null) {
    return null;
  }
  if (scope.motherMeters.length === 0) {
    return createEmptySummary(input.motherMeterType);
  }

  const summary = createEmptySummary(input.motherMeterType);
  const motherMeterIds = scope.motherMeters.map((row) => row.id);
  const typeByMotherMeterId = new Map(
    scope.motherMeters.map((row) => [row.id, row.type] as const),
  );
  summary.motherMeterCounts.postpaid = scope.motherMeters.filter(
    (row) => row.type === "postpaid",
  ).length;
  summary.motherMeterCounts.prepaid = scope.motherMeters.filter(
    (row) => row.type === "prepaid",
  ).length;
  summary.motherMeterCounts.total = scope.motherMeters.length;
  summary.breakdown.postpaid.motherMeterCount = summary.motherMeterCounts.postpaid;
  summary.breakdown.prepaid.motherMeterCount = summary.motherMeterCounts.prepaid;

  const purchaseRows = await listScopedPurchaseTotals(motherMeterIds, input);

  for (const row of purchaseRows) {
    const type = typeByMotherMeterId.get(row.motherMeterId);
    if (!type) {
      continue;
    }
    summary.breakdown[type].tenantPurchaseCount = row.tenantPurchaseCount;
    summary.breakdown[type].tenantPurchasesNetAmount = row.tenantPurchasesNetAmount;
    summary.breakdown[type].tenantUnitsPurchased = row.tenantUnitsPurchased;
  }

  summary.totals = {
    tenantPurchaseCount:
      summary.breakdown.prepaid.tenantPurchaseCount +
      summary.breakdown.postpaid.tenantPurchaseCount,
    tenantPurchasesNetAmount: sumMoney(
      summary.breakdown.prepaid.tenantPurchasesNetAmount,
      summary.breakdown.postpaid.tenantPurchasesNetAmount,
    ),
    tenantUnitsPurchased: sumUnits(
      summary.breakdown.prepaid.tenantUnitsPurchased,
      summary.breakdown.postpaid.tenantUnitsPurchased,
    ),
  };

  return summary;
}

async function listScopedPurchaseTotals(
  motherMeterIds: string[],
  input: PropertyAnalyticsSummaryInput,
) {
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
    .groupBy(meters.motherMeterId);
}

function createEmptySummary(
  motherMeterType?: "postpaid" | "prepaid",
): LandlordPropertyAnalyticsSummary {
  return {
    breakdown: {
      postpaid: {
        motherMeterCount: 0,
        tenantPurchaseCount: 0,
        tenantPurchasesNetAmount: "0.00",
        tenantUnitsPurchased: "0.0000",
      },
      prepaid: {
        motherMeterCount: 0,
        tenantPurchaseCount: 0,
        tenantPurchasesNetAmount: "0.00",
        tenantUnitsPurchased: "0.0000",
      },
    },
    motherMeterCounts: {
      postpaid: 0,
      prepaid: 0,
      total: 0,
    },
    motherMeterType: motherMeterType ?? null,
    totals: {
      tenantPurchaseCount: 0,
      tenantPurchasesNetAmount: "0.00",
      tenantUnitsPurchased: "0.0000",
    },
  };
}

function sumMoney(left: string, right: string) {
  return (Number.parseFloat(left) + Number.parseFloat(right)).toFixed(2);
}

function sumUnits(left: string, right: string) {
  return (Number.parseFloat(left) + Number.parseFloat(right)).toFixed(4);
}
