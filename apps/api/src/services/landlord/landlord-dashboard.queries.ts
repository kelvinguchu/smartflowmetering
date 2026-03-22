import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import { meters, motherMeterEvents, motherMeters, properties, transactions } from "../../db/schema";
import { toNumber } from "./landlord-dashboard.utils";

export interface LandlordMotherMeterRow {
  id: string;
  lowBalanceThreshold: string;
  motherMeterNumber: string;
  propertyId: string;
  propertyLocation: string;
  propertyName: string;
  type: "postpaid" | "prepaid";
}

export interface LandlordSubMeterRow {
  id: string;
  lastPurchaseAt: string | null;
  meterNumber: string;
  meterType: "electricity" | "gas" | "water";
  motherMeterId: string;
  status: "active" | "inactive" | "suspended";
  totalCompletedPurchases: number;
  totalNetSales: number;
  totalUnitsPurchased: number;
}

export interface LandlordMotherMeterAggregate {
  companyPaymentsToUtility: number;
  lastBillPaymentAt: string | null;
  lastPurchaseAt: string | null;
  netSalesCollected: number;
  utilityFundingLoaded: number;
}

export async function getLandlordMotherMeterRows(
  landlordId: string,
  motherMeterId?: string,
  propertyId?: string,
): Promise<LandlordMotherMeterRow[]> {
  const conditions = [eq(motherMeters.landlordId, landlordId)];
  if (motherMeterId) {
    conditions.push(eq(motherMeters.id, motherMeterId));
  }
  if (propertyId) {
    conditions.push(eq(motherMeters.propertyId, propertyId));
  }

  return db
    .select({
      id: motherMeters.id,
      lowBalanceThreshold: motherMeters.lowBalanceThreshold,
      motherMeterNumber: motherMeters.motherMeterNumber,
      propertyId: properties.id,
      propertyLocation: properties.location,
      propertyName: properties.name,
      type: motherMeters.type,
    })
    .from(motherMeters)
    .innerJoin(properties, eq(motherMeters.propertyId, properties.id))
    .where(and(...conditions))
    .orderBy(motherMeters.createdAt);
}

export async function getLandlordSubMeterRows(
  motherMeterIds: string[],
): Promise<LandlordSubMeterRow[]> {
  const rows = await db
    .select({
      id: meters.id,
      lastPurchaseAt: sql<string | null>`max(${transactions.completedAt})`,
      meterNumber: meters.meterNumber,
      meterType: meters.meterType,
      motherMeterId: meters.motherMeterId,
      status: meters.status,
      totalCompletedPurchases:
        sql<number>`count(${transactions.id}) filter (where ${transactions.status} = 'completed')::int`,
      totalNetSales:
        sql<string>`coalesce(sum(case when ${transactions.status} = 'completed' then ${transactions.netAmount}::numeric else 0 end), 0)::text`,
      totalUnitsPurchased:
        sql<string>`coalesce(sum(case when ${transactions.status} = 'completed' then ${transactions.unitsPurchased}::numeric else 0 end), 0)::text`,
    })
    .from(meters)
    .leftJoin(transactions, eq(transactions.meterId, meters.id))
    .where(inArray(meters.motherMeterId, motherMeterIds))
    .groupBy(meters.id);

  return rows.map((row) => ({
    ...row,
    totalNetSales: toNumber(row.totalNetSales),
    totalUnitsPurchased: toNumber(row.totalUnitsPurchased),
  }));
}

export async function getMotherMeterEventAggregates(
  motherMeterIds: string[],
): Promise<Map<string, LandlordMotherMeterAggregate>> {
  const [salesRows, eventRows] = await Promise.all([
    db
      .select({
        lastPurchaseAt: sql<string | null>`max(${transactions.completedAt})`,
        motherMeterId: meters.motherMeterId,
        netSalesCollected:
          sql<string>`coalesce(sum(case when ${transactions.status} = 'completed' then ${transactions.netAmount}::numeric else 0 end), 0)::text`,
      })
      .from(meters)
      .leftJoin(transactions, eq(transactions.meterId, meters.id))
      .where(inArray(meters.motherMeterId, motherMeterIds))
      .groupBy(meters.motherMeterId),
    db
      .select({
        companyPaymentsToUtility:
          sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} = 'bill_payment' then ${motherMeterEvents.amount}::numeric else 0 end), 0)::text`,
        lastBillPaymentAt:
          sql<string | null>`max(case when ${motherMeterEvents.eventType} = 'bill_payment' then ${motherMeterEvents.createdAt} else null end)`,
        motherMeterId: motherMeterEvents.motherMeterId,
        utilityFundingLoaded:
          sql<string>`coalesce(sum(case when ${motherMeterEvents.eventType} in ('initial_deposit', 'refill') then ${motherMeterEvents.amount}::numeric else 0 end), 0)::text`,
      })
      .from(motherMeterEvents)
      .where(inArray(motherMeterEvents.motherMeterId, motherMeterIds))
      .groupBy(motherMeterEvents.motherMeterId),
  ]);

  const result = new Map<string, LandlordMotherMeterAggregate>();

  for (const row of salesRows) {
    result.set(row.motherMeterId, {
      companyPaymentsToUtility: 0,
      lastBillPaymentAt: null,
      lastPurchaseAt: row.lastPurchaseAt,
      netSalesCollected: toNumber(row.netSalesCollected),
      utilityFundingLoaded: 0,
    });
  }

  for (const row of eventRows) {
    const current = result.get(row.motherMeterId);
    result.set(row.motherMeterId, {
      companyPaymentsToUtility: toNumber(row.companyPaymentsToUtility),
      lastBillPaymentAt: row.lastBillPaymentAt,
      lastPurchaseAt: current?.lastPurchaseAt ?? null,
      netSalesCollected: current?.netSalesCollected ?? 0,
      utilityFundingLoaded: toNumber(row.utilityFundingLoaded),
    });
  }

  return result;
}
