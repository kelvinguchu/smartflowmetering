import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { meters, motherMeters, properties, transactions } from "../db/schema";
import { toNumber } from "./landlord-dashboard.utils";
import type { TenantAccessSummary } from "./tenant-access.types";
import type { TenantDashboardSummary, TenantPurchaseItem } from "./tenant-dashboard.types";

export async function getTenantDashboardSummary(
  tenantAccess: TenantAccessSummary,
): Promise<TenantDashboardSummary> {
  const rows = await db
    .select({
      lastPurchaseAt: sql<string | null>`max(${transactions.completedAt})`,
      meterId: meters.id,
      meterNumber: meters.meterNumber,
      meterStatus: meters.status,
      meterType: meters.meterType,
      motherMeterId: motherMeters.id,
      motherMeterNumber: motherMeters.motherMeterNumber,
      motherMeterType: motherMeters.type,
      propertyId: properties.id,
      propertyName: properties.name,
      totalCompletedPurchases:
        sql<number>`count(${transactions.id}) filter (where ${transactions.status} = 'completed')::int`,
      totalMeterCreditAmount:
        sql<string>`coalesce(sum(case when ${transactions.status} = 'completed' then ${transactions.netAmount}::numeric else 0 end), 0)::text`,
      totalUnitsPurchased:
        sql<string>`coalesce(sum(case when ${transactions.status} = 'completed' then ${transactions.unitsPurchased}::numeric else 0 end), 0)::text`,
    })
    .from(meters)
    .innerJoin(motherMeters, eq(meters.motherMeterId, motherMeters.id))
    .innerJoin(properties, eq(motherMeters.propertyId, properties.id))
    .leftJoin(transactions, eq(transactions.meterId, meters.id))
    .where(eq(meters.id, tenantAccess.meterId))
    .groupBy(meters.id, motherMeters.id, properties.id)
    .limit(1);

  const row = rows[0];

  return {
    activity: {
      lastPurchaseAt: row.lastPurchaseAt,
      totalCompletedPurchases: row.totalCompletedPurchases,
    },
    meter: {
      meterNumber: row.meterNumber,
      meterType: row.meterType,
      status: row.meterStatus,
    },
    motherMeter: {
      motherMeterNumber: row.motherMeterNumber,
      type: row.motherMeterType,
    },
    property: {
      name: row.propertyName,
    },
    totals: {
      totalMeterCreditAmount: toNumber(row.totalMeterCreditAmount).toFixed(2),
      totalUnitsPurchased: toNumber(row.totalUnitsPurchased).toFixed(4),
    },
  };
}

export async function listTenantPurchases(
  tenantAccess: TenantAccessSummary,
  input: {
    endDate?: string;
    limit?: number;
    offset?: number;
    startDate?: string;
  },
): Promise<TenantPurchaseItem[]> {
  const filters = [
    eq(transactions.meterId, tenantAccess.meterId),
    eq(transactions.status, "completed"),
  ];
  if (input.startDate) {
    filters.push(gte(transactions.completedAt, new Date(input.startDate)));
  }
  if (input.endDate) {
    filters.push(lte(transactions.completedAt, new Date(input.endDate)));
  }

  const rows = await db
    .select({
      completedAt: transactions.completedAt,
      meterCreditAmount: transactions.netAmount,
      mpesaReceiptNumber: transactions.mpesaReceiptNumber,
      paymentMethod: transactions.paymentMethod,
      transactionId: transactions.transactionId,
      unitsPurchased: transactions.unitsPurchased,
    })
    .from(transactions)
    .where(and(...filters))
    .orderBy(desc(transactions.completedAt), desc(transactions.createdAt))
    .limit(input.limit ?? 20)
    .offset(input.offset ?? 0);

  return rows.map((row) => ({
    completedAt: row.completedAt?.toISOString() ?? null,
    meterCreditAmount: toNumber(row.meterCreditAmount).toFixed(2),
    mpesaReceiptNumber: row.mpesaReceiptNumber,
    paymentMethod: row.paymentMethod,
    transactionId: row.transactionId,
    unitsPurchased: toNumber(row.unitsPurchased).toFixed(4),
  }));
}
