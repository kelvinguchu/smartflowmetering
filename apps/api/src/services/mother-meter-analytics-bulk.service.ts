import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  meters,
  motherMeterEvents,
  transactions,
} from "../db/schema";

interface MotherMeterBalanceTotals {
  billPayments: number;
  deposits: number;
  netSales: number;
}

export async function loadMotherMeterBalanceTotals(
  motherMeterIds: string[],
): Promise<Map<string, MotherMeterBalanceTotals>> {
  if (motherMeterIds.length === 0) {
    return new Map();
  }

  const [eventRows, salesRows] = await Promise.all([
    db
      .select({
        billPayments:
          sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} = 'bill_payment' then ${motherMeterEvents.amount}::numeric else 0 end), 0)`,
        deposits:
          sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} in ('initial_deposit', 'refill') then ${motherMeterEvents.amount}::numeric else 0 end), 0)`,
        motherMeterId: motherMeterEvents.motherMeterId,
      })
      .from(motherMeterEvents)
      .where(inArray(motherMeterEvents.motherMeterId, motherMeterIds))
      .groupBy(motherMeterEvents.motherMeterId),
    db
      .select({
        motherMeterId: meters.motherMeterId,
        netSales: sql<string>`coalesce(sum(${transactions.netAmount}::numeric), 0)`,
      })
      .from(transactions)
      .innerJoin(meters, eq(transactions.meterId, meters.id))
      .where(
        and(
          inArray(meters.motherMeterId, motherMeterIds),
          eq(transactions.status, "completed"),
        ),
      )
      .groupBy(meters.motherMeterId),
  ]);

  const totals = new Map<string, MotherMeterBalanceTotals>();

  for (const row of eventRows) {
    totals.set(row.motherMeterId, {
      billPayments: toNumber(row.billPayments),
      deposits: toNumber(row.deposits),
      netSales: 0,
    });
  }

  for (const row of salesRows) {
    const existing = totals.get(row.motherMeterId);
    totals.set(row.motherMeterId, {
      billPayments: existing?.billPayments ?? 0,
      deposits: existing?.deposits ?? 0,
      netSales: toNumber(row.netSales),
    });
  }

  return totals;
}

export async function loadLatestBillPaymentDates(
  motherMeterIds: string[],
): Promise<Map<string, Date | null>> {
  if (motherMeterIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      lastBillPaymentAt: sql<Date | null>`max(${motherMeterEvents.createdAt})`,
      motherMeterId: motherMeterEvents.motherMeterId,
    })
    .from(motherMeterEvents)
    .where(
      and(
        inArray(motherMeterEvents.motherMeterId, motherMeterIds),
        eq(motherMeterEvents.eventType, "bill_payment"),
      ),
    )
    .groupBy(motherMeterEvents.motherMeterId);

  return new Map(
    rows.map((row) => [
      row.motherMeterId,
      normalizeDateValue(row.lastBillPaymentAt),
    ]),
  );
}

function toNumber(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDateValue(value: Date | string | null): Date | null {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}
