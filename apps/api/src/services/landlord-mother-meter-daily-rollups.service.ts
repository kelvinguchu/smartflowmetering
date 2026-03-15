import { and, asc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { meters, motherMeterEvents, transactions } from "../db/schema";
import type { LandlordMotherMeterDailyRollupItem } from "./landlord-daily-rollups.types";
import { getLandlordMotherMeterRows } from "./landlord-dashboard.queries";
import { toNumber } from "./landlord-dashboard.utils";

interface DailyRollupInput {
  endDate?: string;
  limit?: number;
  offset?: number;
  startDate?: string;
}

export async function getLandlordMotherMeterDailyRollups(
  landlordId: string,
  motherMeterId: string,
  input: DailyRollupInput,
): Promise<LandlordMotherMeterDailyRollupItem[] | null> {
  const motherMeterRows = await getLandlordMotherMeterRows(landlordId, motherMeterId);
  if (motherMeterRows.length === 0) {
    return null;
  }

  const motherMeter = motherMeterRows[0];
  const baseline = await getMotherMeterBaseline(motherMeterId, input.startDate);
  const eventRows = await listMotherMeterEventDays(motherMeterId, input);
  const purchaseRows = await listMotherMeterPurchaseDays(motherMeterId, input);

  const rollupMap = new Map<string, DailyAccumulator>();
  for (const row of eventRows) {
    const current = rollupMap.get(row.date) ?? createEmptyAccumulator();
    current.companyPaymentsToUtility += toNumber(row.billPayments);
    current.utilityFundingLoaded += toNumber(row.utilityFundingLoaded);
    rollupMap.set(row.date, current);
  }

  for (const row of purchaseRows) {
    const current = rollupMap.get(row.date) ?? createEmptyAccumulator();
    current.tenantPurchaseCount += row.tenantPurchaseCount;
    current.tenantPurchasesNetAmount += toNumber(row.tenantPurchasesNetAmount);
    current.tenantUnitsPurchased += toNumber(row.tenantUnitsPurchased);
    rollupMap.set(row.date, current);
  }

  let runningCompanyPayments = baseline.companyPaymentsToUtility;
  let runningNetSales = baseline.tenantPurchasesNetAmount;
  let runningUtilityFunding = baseline.utilityFundingLoaded;

  return [...rollupMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? 60))
    .map(([date, totals]) => {
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
        date,
        financialSnapshot: {
          companyPaymentsToUtility: runningCompanyPayments.toFixed(2),
          netSalesCollected: runningNetSales.toFixed(2),
          postpaidOutstandingAmount:
            motherMeter.type === "postpaid"
              ? postpaidOutstandingAmount.toFixed(2)
              : null,
          prepaidEstimatedBalance:
            motherMeter.type === "prepaid"
              ? prepaidEstimatedBalance.toFixed(2)
              : null,
          utilityFundingLoaded: runningUtilityFunding.toFixed(2),
        },
        motherMeter: {
          id: motherMeter.id,
          motherMeterNumber: motherMeter.motherMeterNumber,
          type: motherMeter.type,
        },
        totals: {
          companyPaymentsToUtility: totals.companyPaymentsToUtility.toFixed(2),
          tenantPurchaseCount: totals.tenantPurchaseCount,
          tenantPurchasesNetAmount: totals.tenantPurchasesNetAmount.toFixed(2),
          tenantUnitsPurchased: totals.tenantUnitsPurchased.toFixed(4),
          utilityFundingLoaded: totals.utilityFundingLoaded.toFixed(2),
        },
      };
    })
    .reverse();
}

async function getMotherMeterBaseline(motherMeterId: string, startDate?: string) {
  if (!startDate) {
    return createEmptyAccumulator();
  }

  const beforeStart = new Date(`${startDate}T00:00:00.000Z`);
  const [eventRows, purchaseRows] = await Promise.all([
    db
      .select({
        billPayments:
          sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} = 'bill_payment' then ${motherMeterEvents.amount}::numeric else 0 end), 0)::text`,
        utilityFundingLoaded:
          sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} in ('initial_deposit', 'refill') then ${motherMeterEvents.amount}::numeric else 0 end), 0)::text`,
      })
      .from(motherMeterEvents)
      .where(
        and(
          eq(motherMeterEvents.motherMeterId, motherMeterId),
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
          eq(meters.motherMeterId, motherMeterId),
          eq(transactions.status, "completed"),
          lt(transactions.completedAt, beforeStart),
        ),
      )
      .limit(1),
  ]);

  return {
    companyPaymentsToUtility: toNumber(eventRows[0]?.billPayments),
    tenantPurchaseCount: 0,
    tenantPurchasesNetAmount: toNumber(purchaseRows[0]?.tenantPurchasesNetAmount),
    tenantUnitsPurchased: 0,
    utilityFundingLoaded: toNumber(eventRows[0]?.utilityFundingLoaded),
  };
}

async function listMotherMeterEventDays(motherMeterId: string, input: DailyRollupInput) {
  const dateExpr =
    sql<string>`to_char((${motherMeterEvents.createdAt} AT TIME ZONE 'Africa/Nairobi')::date, 'YYYY-MM-DD')`;
  const filters = [eq(motherMeterEvents.motherMeterId, motherMeterId)];
  if (input.startDate) {
    filters.push(gte(motherMeterEvents.createdAt, new Date(input.startDate)));
  }
  if (input.endDate) {
    filters.push(lte(motherMeterEvents.createdAt, new Date(input.endDate)));
  }

  return db
    .select({
      billPayments:
        sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} = 'bill_payment' then ${motherMeterEvents.amount}::numeric else 0 end), 0)::text`,
      date: dateExpr,
      utilityFundingLoaded:
        sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} in ('initial_deposit', 'refill') then ${motherMeterEvents.amount}::numeric else 0 end), 0)::text`,
    })
    .from(motherMeterEvents)
    .where(and(...filters))
    .groupBy(dateExpr)
    .orderBy(asc(dateExpr));
}

async function listMotherMeterPurchaseDays(motherMeterId: string, input: DailyRollupInput) {
  const dateExpr =
    sql<string>`to_char((${transactions.completedAt} AT TIME ZONE 'Africa/Nairobi')::date, 'YYYY-MM-DD')`;
  const filters = [eq(meters.motherMeterId, motherMeterId), eq(transactions.status, "completed")];
  if (input.startDate) {
    filters.push(gte(transactions.completedAt, new Date(input.startDate)));
  }
  if (input.endDate) {
    filters.push(lte(transactions.completedAt, new Date(input.endDate)));
  }

  return db
    .select({
      date: dateExpr,
      tenantPurchaseCount: sql<number>`count(${transactions.id})::int`,
      tenantPurchasesNetAmount:
        sql<string>`coalesce(sum(${transactions.netAmount}::numeric), 0)::text`,
      tenantUnitsPurchased:
        sql<string>`coalesce(sum(${transactions.unitsPurchased}::numeric), 0)::text`,
    })
    .from(transactions)
    .innerJoin(meters, eq(transactions.meterId, meters.id))
    .where(and(...filters))
    .groupBy(dateExpr)
    .orderBy(asc(dateExpr));
}

interface DailyAccumulator {
  companyPaymentsToUtility: number;
  tenantPurchaseCount: number;
  tenantPurchasesNetAmount: number;
  tenantUnitsPurchased: number;
  utilityFundingLoaded: number;
}

function createEmptyAccumulator(): DailyAccumulator {
  return {
    companyPaymentsToUtility: 0,
    tenantPurchaseCount: 0,
    tenantPurchasesNetAmount: 0,
    tenantUnitsPurchased: 0,
    utilityFundingLoaded: 0,
  };
}
