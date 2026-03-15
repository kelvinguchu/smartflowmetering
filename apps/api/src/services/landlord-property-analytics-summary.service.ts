import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { meters, motherMeterEvents, transactions } from "../db/schema";
import { toNumber } from "./landlord-dashboard.utils";
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

  const summary = createEmptySummary(propertyId, input.motherMeterType);
  if (scope.motherMeters.length === 0) {
    return summary;
  }

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

  const [eventRows, purchaseRows] = await Promise.all([
    listScopedEventTotals(motherMeterIds, input),
    listScopedPurchaseTotals(motherMeterIds, input),
  ]);

  for (const row of eventRows) {
    const type = typeByMotherMeterId.get(row.motherMeterId);
    if (!type) {
      continue;
    }
    summary.breakdown[type].companyPaymentsToUtility = toNumber(
      row.companyPaymentsToUtility,
    ).toFixed(2);
    summary.breakdown[type].utilityFundingLoaded = toNumber(
      row.utilityFundingLoaded,
    ).toFixed(2);
  }

  for (const row of purchaseRows) {
    const type = typeByMotherMeterId.get(row.motherMeterId);
    if (!type) {
      continue;
    }
    summary.breakdown[type].tenantPurchaseCount = row.tenantPurchaseCount;
    summary.breakdown[type].tenantPurchasesNetAmount = toNumber(
      row.tenantPurchasesNetAmount,
    ).toFixed(2);
    summary.breakdown[type].tenantUnitsPurchased = toNumber(
      row.tenantUnitsPurchased,
    ).toFixed(4);
  }

  summary.totals = {
    companyPaymentsToUtility: (
      toNumber(summary.breakdown.prepaid.companyPaymentsToUtility) +
      toNumber(summary.breakdown.postpaid.companyPaymentsToUtility)
    ).toFixed(2),
    tenantPurchaseCount:
      summary.breakdown.prepaid.tenantPurchaseCount +
      summary.breakdown.postpaid.tenantPurchaseCount,
    tenantPurchasesNetAmount: (
      toNumber(summary.breakdown.prepaid.tenantPurchasesNetAmount) +
      toNumber(summary.breakdown.postpaid.tenantPurchasesNetAmount)
    ).toFixed(2),
    tenantUnitsPurchased: (
      toNumber(summary.breakdown.prepaid.tenantUnitsPurchased) +
      toNumber(summary.breakdown.postpaid.tenantUnitsPurchased)
    ).toFixed(4),
    utilityFundingLoaded: (
      toNumber(summary.breakdown.prepaid.utilityFundingLoaded) +
      toNumber(summary.breakdown.postpaid.utilityFundingLoaded)
    ).toFixed(2),
  };

  return summary;
}

async function listScopedEventTotals(
  motherMeterIds: string[],
  input: PropertyAnalyticsSummaryInput,
) {
  const filters = [inArray(motherMeterEvents.motherMeterId, motherMeterIds)];
  if (input.startDate) {
    filters.push(gte(motherMeterEvents.createdAt, new Date(input.startDate)));
  }
  if (input.endDate) {
    filters.push(lte(motherMeterEvents.createdAt, new Date(input.endDate)));
  }

  return db
    .select({
      companyPaymentsToUtility:
        sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} = 'bill_payment' then ${motherMeterEvents.amount}::numeric else 0 end), 0)::text`,
      motherMeterId: motherMeterEvents.motherMeterId,
      utilityFundingLoaded:
        sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} in ('initial_deposit', 'refill') then ${motherMeterEvents.amount}::numeric else 0 end), 0)::text`,
    })
    .from(motherMeterEvents)
    .where(and(...filters))
    .groupBy(motherMeterEvents.motherMeterId);
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
        sql<string>`coalesce(sum(${transactions.netAmount}::numeric), 0)::text`,
      tenantUnitsPurchased:
        sql<string>`coalesce(sum(${transactions.unitsPurchased}::numeric), 0)::text`,
    })
    .from(transactions)
    .innerJoin(meters, eq(transactions.meterId, meters.id))
    .where(and(...filters))
    .groupBy(meters.motherMeterId);
}

function createEmptySummary(
  propertyId: string,
  motherMeterType?: "postpaid" | "prepaid",
): LandlordPropertyAnalyticsSummary {
  return {
    breakdown: {
      postpaid: {
        companyPaymentsToUtility: "0.00",
        motherMeterCount: 0,
        tenantPurchaseCount: 0,
        tenantPurchasesNetAmount: "0.00",
        tenantUnitsPurchased: "0.0000",
        utilityFundingLoaded: "0.00",
      },
      prepaid: {
        companyPaymentsToUtility: "0.00",
        motherMeterCount: 0,
        tenantPurchaseCount: 0,
        tenantPurchasesNetAmount: "0.00",
        tenantUnitsPurchased: "0.0000",
        utilityFundingLoaded: "0.00",
      },
    },
    motherMeterCounts: {
      postpaid: 0,
      prepaid: 0,
      total: 0,
    },
    motherMeterType: motherMeterType ?? null,
    property: {
      id: propertyId,
    },
    totals: {
      companyPaymentsToUtility: "0.00",
      tenantPurchaseCount: 0,
      tenantPurchasesNetAmount: "0.00",
      tenantUnitsPurchased: "0.0000",
      utilityFundingLoaded: "0.00",
    },
  };
}
