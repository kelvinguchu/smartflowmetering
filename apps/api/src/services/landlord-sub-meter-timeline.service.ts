import { and, asc, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { meters, motherMeters, transactions } from "../db/schema";
import { toNumber } from "./landlord-dashboard.utils";
import type { LandlordSubMeterTimelineItem } from "./landlord-sub-meter.types";

interface TimelineWindowInput {
  endDate?: string;
  limit?: number;
  offset?: number;
  startDate?: string;
}

export async function getLandlordSubMeterTimeline(
  landlordId: string,
  meterId: string,
  input: TimelineWindowInput,
): Promise<LandlordSubMeterTimelineItem[] | null> {
  const meterRows = await db
    .select({ id: meters.id })
    .from(meters)
    .innerJoin(motherMeters, eq(meters.motherMeterId, motherMeters.id))
    .where(and(eq(meters.id, meterId), eq(motherMeters.landlordId, landlordId)))
    .limit(1);

  if (meterRows.length === 0) {
    return null;
  }

  const [baselineRows, purchaseRows] = await Promise.all([
    input.startDate
      ? db
          .select({
            totalNetSales:
              sql<string>`coalesce(sum(${transactions.netAmount}::numeric), 0)::text`,
            totalUnitsPurchased:
              sql<string>`coalesce(sum(${transactions.unitsPurchased}::numeric), 0)::text`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.meterId, meterId),
              eq(transactions.status, "completed"),
              lt(transactions.completedAt, new Date(`${input.startDate}T00:00:00.000Z`)),
            ),
          )
          .limit(1)
      : Promise.resolve([]),
    listTimelinePurchases(meterId, input),
  ]);

  let cumulativeNetSales = toNumber(baselineRows[0]?.totalNetSales);
  let cumulativeUnitsPurchased = toNumber(baselineRows[0]?.totalUnitsPurchased);

  const orderedRows = purchaseRows
    .filter((row): row is typeof row & { occurredAt: Date } => row.occurredAt !== null)
    .sort((left, right) => {
      const timeDelta = left.occurredAt.getTime() - right.occurredAt.getTime();
      if (timeDelta !== 0) {
        return timeDelta;
      }

      return left.transactionId.localeCompare(right.transactionId);
    });

  const timeline = orderedRows.map((row) => {
    cumulativeNetSales += toNumber(row.meterCreditAmount);
    cumulativeUnitsPurchased += toNumber(row.unitsPurchased);
    return {
      cumulativeNetSales: cumulativeNetSales.toFixed(2),
      cumulativeUnitsPurchased: cumulativeUnitsPurchased.toFixed(4),
      meterCreditAmount: toNumber(row.meterCreditAmount).toFixed(2),
      mpesaReceiptNumber: row.mpesaReceiptNumber,
      occurredAt: row.occurredAt.toISOString(),
      phoneNumber: row.phoneNumber,
      transactionId: row.transactionId,
      unitsPurchased: toNumber(row.unitsPurchased).toFixed(4),
    };
  });

  return timeline.reverse().slice(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? 50));
}

async function listTimelinePurchases(meterId: string, input: TimelineWindowInput) {
  const filters = [eq(transactions.meterId, meterId), eq(transactions.status, "completed")];
  if (input.startDate) {
    filters.push(gte(transactions.completedAt, new Date(input.startDate)));
  }
  if (input.endDate) {
    filters.push(lte(transactions.completedAt, new Date(input.endDate)));
  }

  return db
    .select({
      meterCreditAmount: transactions.netAmount,
      mpesaReceiptNumber: transactions.mpesaReceiptNumber,
      occurredAt: transactions.completedAt,
      phoneNumber: transactions.phoneNumber,
      transactionId: transactions.transactionId,
      unitsPurchased: transactions.unitsPurchased,
    })
    .from(transactions)
    .where(and(...filters))
    .orderBy(desc(transactions.completedAt), asc(transactions.createdAt));
}
