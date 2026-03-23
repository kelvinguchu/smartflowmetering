import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { meters, motherMeters, transactions } from "../../db/schema";
import { toNumber } from "./landlord-dashboard.utils";
import type { LandlordSubMeterDetail } from "./landlord-sub-meter.types";

export async function getLandlordSubMeterDetail(
  landlordId: string,
  meterId: string,
  purchaseLimit = 20,
): Promise<LandlordSubMeterDetail | null> {
  const meterRows = await db
    .select({
      id: meters.id,
      meterNumber: meters.meterNumber,
      meterType: meters.meterType,
      motherMeterId: motherMeters.id,
      motherMeterNumber: motherMeters.motherMeterNumber,
      motherMeterType: motherMeters.type,
      status: meters.status,
    })
    .from(meters)
    .innerJoin(motherMeters, eq(meters.motherMeterId, motherMeters.id))
    .where(and(eq(meters.id, meterId), eq(motherMeters.landlordId, landlordId)))
    .limit(1);

  if (meterRows.length === 0) {
    return null;
  }
  const meterRow = meterRows[0];

  const [aggregateRows, recentPurchases] = await Promise.all([
    db
      .select({
        lastPurchaseAt: sql<string | null>`max(${transactions.completedAt})`,
        totalCompletedPurchases:
          sql<number>`count(${transactions.id}) filter (where ${transactions.status} = 'completed')::int`,
        totalNetSales:
          sql<string>`coalesce(sum(case when ${transactions.status} = 'completed' then ${transactions.netAmount}::numeric else 0 end), 0)::text`,
        totalUnitsPurchased:
          sql<string>`coalesce(sum(case when ${transactions.status} = 'completed' then ${transactions.unitsPurchased}::numeric else 0 end), 0)::text`,
      })
      .from(meters)
      .leftJoin(transactions, eq(transactions.meterId, meters.id))
      .where(eq(meters.id, meterId))
      .groupBy(meters.id)
      .limit(1),
    db
      .select({
        completedAt: transactions.completedAt,
        meterCreditAmount: transactions.netAmount,
        mpesaReceiptNumber: transactions.mpesaReceiptNumber,
        phoneNumber: transactions.phoneNumber,
        transactionId: transactions.transactionId,
        unitsPurchased: transactions.unitsPurchased,
      })
      .from(transactions)
      .where(
        and(eq(transactions.meterId, meterId), eq(transactions.status, "completed")),
      )
      .orderBy(desc(transactions.completedAt), desc(transactions.createdAt))
      .limit(purchaseLimit),
  ]);

  if (aggregateRows.length === 0) {
    return null;
  }
  const aggregateRow = aggregateRows[0];

  return {
    activity: {
      lastPurchaseAt: aggregateRow.lastPurchaseAt,
      totalCompletedPurchases: aggregateRow.totalCompletedPurchases,
    },
    meterNumber: meterRow.meterNumber,
    meterType: meterRow.meterType,
    motherMeter: {
      motherMeterNumber: meterRow.motherMeterNumber,
      type: meterRow.motherMeterType,
    },
    recentPurchases: recentPurchases.map((purchase) => ({
      completedAt: purchase.completedAt?.toISOString() ?? null,
      meterCreditAmount: toNumber(purchase.meterCreditAmount).toFixed(2),
      mpesaReceiptNumber: purchase.mpesaReceiptNumber,
      phoneNumber: purchase.phoneNumber,
      transactionId: purchase.transactionId,
      unitsPurchased: toNumber(purchase.unitsPurchased).toFixed(4),
    })),
    status: meterRow.status,
    totals: {
      totalNetSales: toNumber(aggregateRow.totalNetSales).toFixed(2),
      totalUnitsPurchased: toNumber(aggregateRow.totalUnitsPurchased).toFixed(4),
    },
  };
}
