import { and, asc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { db } from "../../db";
import { meters, motherMeters, transactions } from "../../db/schema";
import type { LandlordSubMeterDailyRollupItem } from "./landlord-daily-rollups.types";
import { toNumber } from "./landlord-dashboard.utils";

interface DailyRollupInput {
  endDate?: string;
  limit?: number;
  offset?: number;
  startDate?: string;
}

export async function getLandlordSubMeterDailyRollups(
  landlordId: string,
  meterId: string,
  input: DailyRollupInput,
): Promise<LandlordSubMeterDailyRollupItem[] | null> {
  const meterRows = await db
    .select({
      id: meters.id,
      meterNumber: meters.meterNumber,
      meterType: meters.meterType,
    })
    .from(meters)
    .innerJoin(motherMeters, eq(meters.motherMeterId, motherMeters.id))
    .where(and(eq(meters.id, meterId), eq(motherMeters.landlordId, landlordId)))
    .limit(1);
  if (meterRows.length === 0) {
    return null;
  }

  const meter = meterRows[0];
  const baseline = await getSubMeterBaseline(meterId, input.startDate);
  const dayRows = await listSubMeterPurchaseDays(meterId, input);
  let cumulativeNetSales = baseline.cumulativeNetSales;
  let cumulativeUnitsPurchased = baseline.cumulativeUnitsPurchased;

  return dayRows
    .slice(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? 60))
    .map((row) => {
      cumulativeNetSales += toNumber(row.tenantPurchasesNetAmount);
      cumulativeUnitsPurchased += toNumber(row.tenantUnitsPurchased);
      return {
        cumulativeNetSales: cumulativeNetSales.toFixed(2),
        cumulativeUnitsPurchased: cumulativeUnitsPurchased.toFixed(4),
        date: row.date,
        meter: {
          meterNumber: meter.meterNumber,
          meterType: meter.meterType,
        },
        totals: {
          purchaseCount: row.purchaseCount,
          tenantPurchasesNetAmount: toNumber(row.tenantPurchasesNetAmount).toFixed(2),
          tenantUnitsPurchased: toNumber(row.tenantUnitsPurchased).toFixed(4),
        },
      };
    })
    .reverse();
}

async function getSubMeterBaseline(meterId: string, startDate?: string) {
  if (!startDate) {
    return {
      cumulativeNetSales: 0,
      cumulativeUnitsPurchased: 0,
    };
  }

  const beforeStart = new Date(`${startDate}T00:00:00.000Z`);
  const rows = await db
    .select({
      cumulativeNetSales:
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
    cumulativeNetSales: toNumber(rows[0]?.cumulativeNetSales),
    cumulativeUnitsPurchased: toNumber(rows[0]?.cumulativeUnitsPurchased),
  };
}

async function listSubMeterPurchaseDays(meterId: string, input: DailyRollupInput) {
  const dateExpr =
    sql<string>`to_char((${transactions.completedAt} AT TIME ZONE 'Africa/Nairobi')::date, 'YYYY-MM-DD')`;
  const filters = [eq(transactions.meterId, meterId), eq(transactions.status, "completed")];
  if (input.startDate) {
    filters.push(gte(transactions.completedAt, new Date(input.startDate)));
  }
  if (input.endDate) {
    filters.push(lte(transactions.completedAt, new Date(input.endDate)));
  }

  return db
    .select({
      date: dateExpr,
      purchaseCount: sql<number>`count(${transactions.id})::int`,
      tenantPurchasesNetAmount:
        sql<string>`coalesce(sum(${transactions.netAmount}::numeric), 0)::text`,
      tenantUnitsPurchased:
        sql<string>`coalesce(sum(${transactions.unitsPurchased}::numeric), 0)::text`,
    })
    .from(transactions)
    .where(and(...filters))
    .groupBy(dateExpr)
    .orderBy(asc(dateExpr));
}
