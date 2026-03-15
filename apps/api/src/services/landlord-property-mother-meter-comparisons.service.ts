import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { meters, motherMeterEvents, transactions } from "../db/schema";
import { toNumber } from "./landlord-dashboard.utils";
import { getScopedLandlordPropertyAnalytics } from "./landlord-property-analytics.scope";
import type { LandlordPropertyMotherMeterComparisonItem } from "./landlord-property-analytics.types";

interface ComparisonInput {
  endDate?: string;
  motherMeterType?: "postpaid" | "prepaid";
  startDate?: string;
}

export async function listLandlordPropertyMotherMeterComparisons(
  landlordId: string,
  propertyId: string,
  input: ComparisonInput,
): Promise<LandlordPropertyMotherMeterComparisonItem[] | null> {
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

  const rows = await Promise.all(
    scope.motherMeters.map(async (motherMeter) => {
      const [eventRows, purchaseRows] = await Promise.all([
        db
          .select({
            companyPaymentsToUtility:
              sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} = 'bill_payment' then ${motherMeterEvents.amount}::numeric else 0 end), 0)::text`,
            utilityFundingLoaded:
              sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} in ('initial_deposit', 'refill') then ${motherMeterEvents.amount}::numeric else 0 end), 0)::text`,
          })
          .from(motherMeterEvents)
          .where(and(eq(motherMeterEvents.motherMeterId, motherMeter.id), ...dateFilters(motherMeterEvents.createdAt, input)))
          .limit(1),
        db
          .select({
            tenantPurchaseCount: sql<number>`count(${transactions.id})::int`,
            tenantPurchasesNetAmount:
              sql<string>`coalesce(sum(${transactions.netAmount}::numeric), 0)::text`,
            tenantUnitsPurchased:
              sql<string>`coalesce(sum(${transactions.unitsPurchased}::numeric), 0)::text`,
          })
          .from(transactions)
          .innerJoin(meters, eq(transactions.meterId, meters.id))
          .where(
            and(
              eq(meters.motherMeterId, motherMeter.id),
              eq(transactions.status, "completed"),
              ...dateFilters(transactions.completedAt, input),
            ),
          )
          .limit(1),
      ]);

      const companyPaymentsToUtility = toNumber(eventRows[0]?.companyPaymentsToUtility);
      const utilityFundingLoaded = toNumber(eventRows[0]?.utilityFundingLoaded);
      const tenantPurchasesNetAmount = toNumber(purchaseRows[0]?.tenantPurchasesNetAmount);
      const tenantUnitsPurchased = toNumber(purchaseRows[0]?.tenantUnitsPurchased);
      const postpaidOutstandingAmount = Math.max(
        tenantPurchasesNetAmount - companyPaymentsToUtility,
        0,
      );
      const prepaidEstimatedBalance =
        utilityFundingLoaded - companyPaymentsToUtility - tenantPurchasesNetAmount;

      return {
        financialSnapshot: {
          companyPaymentsToUtility: companyPaymentsToUtility.toFixed(2),
          netSalesCollected: tenantPurchasesNetAmount.toFixed(2),
          postpaidOutstandingAmount:
            motherMeter.type === "postpaid"
              ? postpaidOutstandingAmount.toFixed(2)
              : null,
          prepaidEstimatedBalance:
            motherMeter.type === "prepaid"
              ? prepaidEstimatedBalance.toFixed(2)
              : null,
          utilityFundingLoaded: utilityFundingLoaded.toFixed(2),
        },
        motherMeter: {
          id: motherMeter.id,
          motherMeterNumber: motherMeter.motherMeterNumber,
          type: motherMeter.type,
        },
        motherMeterType: input.motherMeterType ?? null,
        totals: {
          companyPaymentsToUtility: companyPaymentsToUtility.toFixed(2),
          tenantPurchaseCount: purchaseRows[0]?.tenantPurchaseCount ?? 0,
          tenantPurchasesNetAmount: tenantPurchasesNetAmount.toFixed(2),
          tenantUnitsPurchased: tenantUnitsPurchased.toFixed(4),
          utilityFundingLoaded: utilityFundingLoaded.toFixed(2),
        },
      };
    }),
  );

  return rows.sort((left, right) =>
    left.motherMeter.motherMeterNumber.localeCompare(right.motherMeter.motherMeterNumber),
  );
}

function dateFilters(
  column: typeof transactions.completedAt | typeof motherMeterEvents.createdAt,
  input: ComparisonInput,
) {
  const filters = [];
  if (input.startDate) {
    filters.push(gte(column, new Date(input.startDate)));
  }
  if (input.endDate) {
    filters.push(lte(column, new Date(input.endDate)));
  }

  return filters;
}
