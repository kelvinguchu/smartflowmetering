import { and, asc, eq, gte, lt, lte, max, sql } from "drizzle-orm";
import { db } from "../db";
import { meters, motherMeterEvents, transactions } from "../db/schema";
import { getLandlordMotherMeterRows } from "./landlord-dashboard.queries";

interface ThresholdHistoryInput {
  endDate: string;
  startDate: string;
}

export async function getScopedMotherMeter(
  landlordId: string,
  motherMeterId: string,
): Promise<Awaited<ReturnType<typeof getLandlordMotherMeterRows>>[number] | null> {
  const rows = await getLandlordMotherMeterRows(landlordId, motherMeterId);
  return rows.length === 0 ? null : rows[0];
}

export async function getThresholdHistoryBaseline(
  motherMeterId: string,
  startDate: string,
) {
  const beforeStart = new Date(`${startDate}T00:00:00.000Z`);
  const [eventRows, purchaseRows] = await Promise.all([
    db
      .select({
        billPayments:
          sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} = 'bill_payment' then ${motherMeterEvents.amount}::numeric else 0 end), 0)::text`,
        lastBillPaymentAt: max(motherMeterEvents.createdAt),
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
        netSales:
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
    billPayments: eventRows[0]?.billPayments ?? "0",
    lastBillPaymentAt: eventRows[0]?.lastBillPaymentAt ?? null,
    netSales: purchaseRows[0]?.netSales ?? "0",
    utilityFundingLoaded: eventRows[0]?.utilityFundingLoaded ?? "0",
  };
}

export async function listThresholdHistoryPurchaseDays(
  motherMeterId: string,
  input: ThresholdHistoryInput,
) {
  const dateExpr =
    sql<string>`to_char((${transactions.completedAt} AT TIME ZONE 'Africa/Nairobi')::date, 'YYYY-MM-DD')`;
  const end = new Date(`${input.endDate}T23:59:59.999Z`);

  return db
    .select({
      date: dateExpr,
      netSales:
        sql<string>`coalesce(sum(${transactions.netAmount}::numeric), 0)::text`,
    })
    .from(transactions)
    .innerJoin(meters, eq(transactions.meterId, meters.id))
    .where(
      and(
        eq(meters.motherMeterId, motherMeterId),
        eq(transactions.status, "completed"),
        gte(transactions.completedAt, new Date(input.startDate)),
        lte(transactions.completedAt, end),
      ),
    )
    .groupBy(dateExpr)
    .orderBy(asc(dateExpr));
}

export async function listThresholdHistoryEventDays(
  motherMeterId: string,
  input: ThresholdHistoryInput,
) {
  const dateExpr =
    sql<string>`to_char((${motherMeterEvents.createdAt} AT TIME ZONE 'Africa/Nairobi')::date, 'YYYY-MM-DD')`;
  const end = new Date(`${input.endDate}T23:59:59.999Z`);

  return db
    .select({
      billPayments:
        sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} = 'bill_payment' then ${motherMeterEvents.amount}::numeric else 0 end), 0)::text`,
      date: dateExpr,
      lastBillPaymentAt: max(motherMeterEvents.createdAt),
      utilityFundingLoaded:
        sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} in ('initial_deposit', 'refill') then ${motherMeterEvents.amount}::numeric else 0 end), 0)::text`,
    })
    .from(motherMeterEvents)
    .where(
      and(
        eq(motherMeterEvents.motherMeterId, motherMeterId),
        gte(motherMeterEvents.createdAt, new Date(input.startDate)),
        lte(motherMeterEvents.createdAt, end),
      ),
    )
    .groupBy(dateExpr)
    .orderBy(asc(dateExpr));
}
