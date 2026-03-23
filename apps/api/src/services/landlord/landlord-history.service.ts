import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db";
import { meters, motherMeterEvents, motherMeters, transactions } from "../../db/schema";
import {
  getLandlordMotherMeterRows,
  getLandlordSubMeterRows,
  getMotherMeterEventAggregates,
} from "./landlord-dashboard.queries";
import { toNumber } from "./landlord-dashboard.utils";
import type {
  LandlordMotherMeterDetail,
  LandlordUsageHistoryItem,
  LandlordUsageHistorySubMeterItem,
} from "./landlord-history.types";

export async function getLandlordMotherMeterDetail(
  landlordId: string,
  motherMeterId: string,
): Promise<LandlordMotherMeterDetail | null> {
  const motherMeterRows = await getLandlordMotherMeterRows(landlordId, motherMeterId);
  if (motherMeterRows.length === 0) {
    return null;
  }
  const motherMeterRow = motherMeterRows[0];

  const [aggregateMap, subMeterRows, recentEvents, recentPurchases] = await Promise.all([
    getMotherMeterEventAggregates([motherMeterId]),
    getLandlordSubMeterRows([motherMeterId]),
    db.query.motherMeterEvents.findMany({
      where: eq(motherMeterEvents.motherMeterId, motherMeterId),
      orderBy: [desc(motherMeterEvents.createdAt)],
      limit: 20,
    }),
    db
      .select({
        completedAt: transactions.completedAt,
        meterCreditAmount: transactions.netAmount,
        meterNumber: meters.meterNumber,
        mpesaReceiptNumber: transactions.mpesaReceiptNumber,
        phoneNumber: transactions.phoneNumber,
        transactionId: transactions.transactionId,
        unitsPurchased: transactions.unitsPurchased,
      })
      .from(transactions)
      .innerJoin(meters, eq(transactions.meterId, meters.id))
      .where(
        and(
          eq(meters.motherMeterId, motherMeterId),
          eq(transactions.status, "completed"),
        ),
      )
      .orderBy(desc(transactions.completedAt), desc(transactions.createdAt))
      .limit(20),
  ]);

  const aggregate = aggregateMap.get(motherMeterId) ?? {
    companyPaymentsToUtility: 0,
    lastBillPaymentAt: null,
    lastPurchaseAt: null,
    netSalesCollected: 0,
    utilityFundingLoaded: 0,
  };
  const subMeters = subMeterRows
    .map((subMeter) => ({
      activity: {
        lastPurchaseAt: subMeter.lastPurchaseAt,
        totalCompletedPurchases: subMeter.totalCompletedPurchases,
      },
      meterNumber: subMeter.meterNumber,
      meterType: subMeter.meterType,
      status: subMeter.status,
      totalNetSales: subMeter.totalNetSales.toFixed(2),
      totalUnitsPurchased: subMeter.totalUnitsPurchased.toFixed(4),
    }))
    .sort((left, right) => left.meterNumber.localeCompare(right.meterNumber));

  const postpaidOutstandingAmount = Math.max(
    aggregate.netSalesCollected - aggregate.companyPaymentsToUtility,
    0,
  );
  const prepaidEstimatedBalance =
    aggregate.utilityFundingLoaded -
    aggregate.companyPaymentsToUtility -
    aggregate.netSalesCollected;

  return {
    activity: {
      lastBillPaymentAt: aggregate.lastBillPaymentAt,
      lastPurchaseAt: aggregate.lastPurchaseAt,
      totalCompletedPurchases: subMeters.reduce(
        (sum, subMeter) => sum + subMeter.activity.totalCompletedPurchases,
        0,
      ),
    },
    financials: {
      companyPaymentsToUtility: aggregate.companyPaymentsToUtility.toFixed(2),
      netSalesCollected: aggregate.netSalesCollected.toFixed(2),
      postpaidOutstandingAmount:
        motherMeterRow.type === "postpaid"
          ? postpaidOutstandingAmount.toFixed(2)
          : null,
      prepaidEstimatedBalance:
        motherMeterRow.type === "prepaid"
          ? prepaidEstimatedBalance.toFixed(2)
          : null,
      utilityFundingLoaded: aggregate.utilityFundingLoaded.toFixed(2),
    },
    lowBalanceThreshold: toNumber(motherMeterRow.lowBalanceThreshold).toFixed(2),
    motherMeterNumber: motherMeterRow.motherMeterNumber,
    property: {
      location: motherMeterRow.propertyLocation,
      name: motherMeterRow.propertyName,
    },
    recentEvents: recentEvents.map((event) => ({
      amount: toNumber(event.amount).toFixed(2),
      createdAt: event.createdAt.toISOString(),
      eventType: event.eventType,
      kplcReceiptNumber: event.kplcReceiptNumber,
      kplcToken: event.kplcToken,
    })),
    recentPurchases: recentPurchases.map((purchase) => ({
      completedAt: purchase.completedAt?.toISOString() ?? null,
      meterCreditAmount: toNumber(purchase.meterCreditAmount).toFixed(2),
      meterNumber: purchase.meterNumber,
      mpesaReceiptNumber: purchase.mpesaReceiptNumber,
      phoneNumber: purchase.phoneNumber,
      transactionId: purchase.transactionId,
      unitsPurchased: toNumber(purchase.unitsPurchased).toFixed(4),
    })),
    subMeters,
    totals: {
      activeSubMeters: subMeters.filter((subMeter) => subMeter.status === "active")
        .length,
      subMeters: subMeters.length,
    },
    type: motherMeterRow.type,
  };
}

export async function listLandlordUsageHistory(
  landlordId: string,
  input: {
    endDate?: string;
    limit?: number;
    meterNumber?: string;
    motherMeterId?: string;
    offset?: number;
    propertyId?: string;
    startDate?: string;
  },
): Promise<LandlordUsageHistoryItem[]> {
  const filters = [
    eq(motherMeters.landlordId, landlordId),
    eq(transactions.status, "completed"),
  ];
  if (input.motherMeterId) {
    filters.push(eq(motherMeters.id, input.motherMeterId));
  }
  if (input.propertyId) {
    filters.push(eq(motherMeters.propertyId, input.propertyId));
  }
  if (input.meterNumber) {
    filters.push(eq(meters.meterNumber, input.meterNumber));
  }
  if (input.startDate) {
    filters.push(gte(transactions.completedAt, new Date(input.startDate)));
  }
  if (input.endDate) {
    filters.push(lte(transactions.completedAt, new Date(input.endDate)));
  }

  const nairobiDate = sql<string>`to_char((${transactions.completedAt} AT TIME ZONE 'Africa/Nairobi')::date, 'YYYY-MM-DD')`;
  const [dayRows, subMeterRows] = await Promise.all([
    db
      .select({
        date: nairobiDate,
        latestPurchaseAt: sql<string | null>`max(${transactions.completedAt})`,
        meterCreditAmountTotal:
          sql<string>`coalesce(sum(${transactions.netAmount}::numeric), 0)::text`,
        motherMeterId: motherMeters.id,
        motherMeterNumber: motherMeters.motherMeterNumber,
        motherMeterType: motherMeters.type,
        subMetersWithPurchases: sql<number>`count(distinct ${meters.id})::int`,
        transactionCount: sql<number>`count(${transactions.id})::int`,
        unitsPurchased:
          sql<string>`coalesce(sum(${transactions.unitsPurchased}::numeric), 0)::text`,
      })
      .from(transactions)
      .innerJoin(meters, eq(transactions.meterId, meters.id))
      .innerJoin(motherMeters, eq(meters.motherMeterId, motherMeters.id))
      .where(and(...filters))
      .groupBy(nairobiDate, motherMeters.id)
      .orderBy(desc(nairobiDate), motherMeters.motherMeterNumber)
      .limit(input.limit ?? 60)
      .offset(input.offset ?? 0),
    db
      .select({
        date: nairobiDate,
        lastPurchaseAt: sql<string | null>`max(${transactions.completedAt})`,
        meterCreditAmountTotal:
          sql<string>`coalesce(sum(${transactions.netAmount}::numeric), 0)::text`,
        meterNumber: meters.meterNumber,
        motherMeterId: motherMeters.id,
        transactionCount: sql<number>`count(${transactions.id})::int`,
        unitsPurchased:
          sql<string>`coalesce(sum(${transactions.unitsPurchased}::numeric), 0)::text`,
      })
      .from(transactions)
      .innerJoin(meters, eq(transactions.meterId, meters.id))
      .innerJoin(motherMeters, eq(meters.motherMeterId, motherMeters.id))
      .where(and(...filters))
      .groupBy(nairobiDate, motherMeters.id, meters.id)
      .orderBy(desc(nairobiDate), motherMeters.motherMeterNumber, meters.meterNumber),
  ]);

  const subMetersByKey = new Map<string, LandlordUsageHistorySubMeterItem[]>();
  for (const row of subMeterRows) {
    const key = `${row.date}:${row.motherMeterId}`;
    const current = subMetersByKey.get(key) ?? [];
    current.push({
      lastPurchaseAt: row.lastPurchaseAt,
      meterCreditAmountTotal: toNumber(row.meterCreditAmountTotal).toFixed(2),
      meterNumber: row.meterNumber,
      transactionCount: row.transactionCount,
      unitsPurchased: toNumber(row.unitsPurchased).toFixed(4),
    });
    subMetersByKey.set(key, current);
  }

  return dayRows.map((row) => ({
    date: row.date,
    latestPurchaseAt: row.latestPurchaseAt,
    meterCreditAmountTotal: toNumber(row.meterCreditAmountTotal).toFixed(2),
    motherMeter: {
      motherMeterNumber: row.motherMeterNumber,
      type: row.motherMeterType,
    },
    subMeters: (subMetersByKey.get(`${row.date}:${row.motherMeterId}`) ?? []).sort(
      (left, right) => left.meterNumber.localeCompare(right.meterNumber),
    ),
    totals: {
      subMetersWithPurchases: row.subMetersWithPurchases,
      transactionCount: row.transactionCount,
      unitsPurchased: toNumber(row.unitsPurchased).toFixed(4),
    },
  }));
}
