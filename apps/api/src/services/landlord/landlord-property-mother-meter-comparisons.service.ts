import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db";
import { meters, transactions } from "../../db/schema";
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
      const [purchaseRow] = await db
        .select({
          tenantPurchaseCount: sql<number>`count(${transactions.id})::int`,
          tenantPurchasesNetAmount:
            sql<string>`coalesce(sum(${transactions.netAmount}::numeric), 0)::numeric(12,2)::text`,
          tenantUnitsPurchased:
            sql<string>`coalesce(sum(${transactions.unitsPurchased}::numeric), 0)::numeric(12,4)::text`,
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
        .limit(1);

      return {
        motherMeter: {
          motherMeterNumber: motherMeter.motherMeterNumber,
          type: motherMeter.type,
        },
        motherMeterType: input.motherMeterType ?? null,
        totals: {
          tenantPurchaseCount: purchaseRow?.tenantPurchaseCount ?? 0,
          tenantPurchasesNetAmount: purchaseRow?.tenantPurchasesNetAmount ?? "0.00",
          tenantUnitsPurchased: purchaseRow?.tenantUnitsPurchased ?? "0.0000",
        },
      };
    }),
  );

  return rows.sort((left, right) =>
    left.motherMeter.motherMeterNumber.localeCompare(right.motherMeter.motherMeterNumber),
  );
}

function dateFilters(
  column: typeof transactions.completedAt,
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
