import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db";
import { meters, motherMeters, transactions } from "../db/schema";
import {
  getLandlordMotherMeterRows,
  getLandlordSubMeterRows,
  getMotherMeterEventAggregates,
} from "./landlord-dashboard.queries";
import type {
  LandlordDashboardSummary,
  LandlordMotherMeterItem,
  LandlordPurchaseItem,
  LandlordSubMeterItem,
} from "./landlord-dashboard.types";
import { toNumber } from "./landlord-dashboard.utils";

export async function getLandlordDashboardSummary(
  landlordId: string,
  propertyId?: string,
): Promise<LandlordDashboardSummary> {
  const motherMeterItems = await listLandlordMotherMeters(landlordId, propertyId);

  let activeSubMeterCount = 0;
  let companyPaymentsToUtility = 0;
  let lastPurchaseAt: string | null = null;
  let netSalesCollected = 0;
  let postpaidMotherMeterCount = 0;
  let postpaidOutstandingAmount = 0;
  let prepaidEstimatedBalance = 0;
  let prepaidMotherMeterCount = 0;
  let subMeterCount = 0;
  let totalCompletedPurchases = 0;
  let utilityFundingLoaded = 0;

  for (const motherMeter of motherMeterItems) {
    activeSubMeterCount += motherMeter.totals.activeSubMeters;
    companyPaymentsToUtility += Number.parseFloat(
      motherMeter.financials.companyPaymentsToUtility,
    );
    netSalesCollected += Number.parseFloat(motherMeter.financials.netSalesCollected);
    subMeterCount += motherMeter.totals.subMeters;
    totalCompletedPurchases += motherMeter.activity.totalCompletedPurchases;
    utilityFundingLoaded += Number.parseFloat(
      motherMeter.financials.utilityFundingLoaded,
    );

    if (
      motherMeter.activity.lastPurchaseAt &&
      (lastPurchaseAt === null ||
        motherMeter.activity.lastPurchaseAt > lastPurchaseAt)
    ) {
      lastPurchaseAt = motherMeter.activity.lastPurchaseAt;
    }

    if (motherMeter.type === "prepaid") {
      prepaidMotherMeterCount += 1;
      prepaidEstimatedBalance += Number.parseFloat(
        motherMeter.financials.prepaidEstimatedBalance ?? "0",
      );
    } else {
      postpaidMotherMeterCount += 1;
      postpaidOutstandingAmount += Number.parseFloat(
        motherMeter.financials.postpaidOutstandingAmount ?? "0",
      );
    }
  }

  return {
    activity: {
      lastPurchaseAt,
      totalCompletedPurchases,
    },
    financials: {
      companyPaymentsToUtility: companyPaymentsToUtility.toFixed(2),
      netSalesCollected: netSalesCollected.toFixed(2),
      postpaidOutstandingAmount: postpaidOutstandingAmount.toFixed(2),
      prepaidEstimatedBalance: prepaidEstimatedBalance.toFixed(2),
      utilityFundingLoaded: utilityFundingLoaded.toFixed(2),
    },
    overview: {
      activeSubMeterCount,
      motherMeterCount: motherMeterItems.length,
      postpaidMotherMeterCount,
      prepaidMotherMeterCount,
      subMeterCount,
    },
  };
}

export async function listLandlordMotherMeters(
  landlordId: string,
  propertyId?: string,
): Promise<LandlordMotherMeterItem[]> {
  const motherMeterRows = await getLandlordMotherMeterRows(
    landlordId,
    undefined,
    propertyId,
  );
  if (motherMeterRows.length === 0) {
    return [];
  }

  const motherMeterIds = motherMeterRows.map((row) => row.id);
  const eventAggregates = await getMotherMeterEventAggregates(motherMeterIds);
  const subMeterRows = await getLandlordSubMeterRows(motherMeterIds);

  const subMetersByMotherMeterId = new Map<string, LandlordSubMeterItem[]>();
  for (const subMeter of subMeterRows) {
    const current = subMetersByMotherMeterId.get(subMeter.motherMeterId) ?? [];
    current.push({
      activity: {
        lastPurchaseAt: subMeter.lastPurchaseAt,
        totalCompletedPurchases: subMeter.totalCompletedPurchases,
      },
      meterNumber: subMeter.meterNumber,
      meterType: subMeter.meterType,
      status: subMeter.status,
      totalNetSales: subMeter.totalNetSales.toFixed(2),
      totalUnitsPurchased: subMeter.totalUnitsPurchased.toFixed(4),
    });
    subMetersByMotherMeterId.set(subMeter.motherMeterId, current);
  }

  return motherMeterRows.map((row) => {
    const aggregate = eventAggregates.get(row.id) ?? {
      companyPaymentsToUtility: 0,
      lastBillPaymentAt: null,
      lastPurchaseAt: null,
      netSalesCollected: 0,
      utilityFundingLoaded: 0,
    };
    const subMeters = (subMetersByMotherMeterId.get(row.id) ?? []).sort((left, right) =>
      left.meterNumber.localeCompare(right.meterNumber),
    );
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
          row.type === "postpaid" ? postpaidOutstandingAmount.toFixed(2) : null,
        prepaidEstimatedBalance:
          row.type === "prepaid" ? prepaidEstimatedBalance.toFixed(2) : null,
        utilityFundingLoaded: aggregate.utilityFundingLoaded.toFixed(2),
      },
      lowBalanceThreshold: toNumber(row.lowBalanceThreshold).toFixed(2),
      motherMeterNumber: row.motherMeterNumber,
      property: {
        location: row.propertyLocation,
        name: row.propertyName,
      },
      subMeters,
      totals: {
        activeSubMeters: subMeters.filter((subMeter) => subMeter.status === "active")
          .length,
        subMeters: subMeters.length,
      },
      type: row.type,
    };
  });
}

export async function listLandlordPurchases(
  landlordId: string,
  input: {
    endDate?: string;
    limit?: number;
    meterNumber?: string;
    motherMeterNumber?: string;
    offset?: number;
    propertyId?: string;
    startDate?: string;
    status?: "completed" | "failed" | "pending" | "processing";
  },
): Promise<LandlordPurchaseItem[]> {
  const filters = [eq(motherMeters.landlordId, landlordId)];
  if (input.meterNumber) {
    filters.push(eq(meters.meterNumber, input.meterNumber));
  }
  if (input.motherMeterNumber) {
    filters.push(eq(motherMeters.motherMeterNumber, input.motherMeterNumber));
  }
  if (input.propertyId) {
    filters.push(eq(motherMeters.propertyId, input.propertyId));
  }
  if (input.status) {
    filters.push(eq(transactions.status, input.status));
  }
  if (input.startDate) {
    filters.push(gte(transactions.createdAt, new Date(input.startDate)));
  }
  if (input.endDate) {
    filters.push(lte(transactions.createdAt, new Date(input.endDate)));
  }

  const rows = await db
    .select({
      completedAt: transactions.completedAt,
      meterCreditAmount: transactions.netAmount,
      meterId: meters.id,
      meterNumber: meters.meterNumber,
      meterStatus: meters.status,
      meterType: meters.meterType,
      motherMeterId: motherMeters.id,
      motherMeterNumber: motherMeters.motherMeterNumber,
      motherMeterType: motherMeters.type,
      mpesaReceiptNumber: transactions.mpesaReceiptNumber,
      paymentMethod: transactions.paymentMethod,
      phoneNumber: transactions.phoneNumber,
      status: transactions.status,
      transactionId: transactions.transactionId,
      unitsPurchased: transactions.unitsPurchased,
    })
    .from(transactions)
    .innerJoin(meters, eq(transactions.meterId, meters.id))
    .innerJoin(motherMeters, eq(meters.motherMeterId, motherMeters.id))
    .where(and(...filters))
    .orderBy(desc(transactions.createdAt))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);

  return rows.map((row) => ({
    completedAt: row.completedAt?.toISOString() ?? null,
    meter: {
      meterNumber: row.meterNumber,
      meterType: row.meterType,
      status: row.meterStatus,
    },
    meterCreditAmount: toNumber(row.meterCreditAmount).toFixed(2),
    motherMeter: {
      motherMeterNumber: row.motherMeterNumber,
      type: row.motherMeterType,
    },
    mpesaReceiptNumber: row.mpesaReceiptNumber,
    paymentMethod: row.paymentMethod,
    phoneNumber: row.phoneNumber,
    status: row.status,
    transactionId: row.transactionId,
    unitsPurchased: toNumber(row.unitsPurchased).toFixed(4),
  }));
}
