import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db";
import { meters, motherMeterEvents, motherMeters, transactions } from "../db/schema";
import type {
  LandlordActivityItem,
  LandlordActivityType,
} from "./landlord-activity.types";
import { toNumber } from "./landlord-dashboard.utils";

interface ListLandlordActivityInput {
  endDate?: string;
  limit?: number;
  meterNumber?: string;
  motherMeterId?: string;
  offset?: number;
  propertyId?: string;
  startDate?: string;
  type?: LandlordActivityType;
}

export async function listLandlordActivity(
  landlordId: string,
  input: ListLandlordActivityInput,
): Promise<LandlordActivityItem[]> {
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;
  const fetchWindow = limit + offset;
  const includePurchases = input.type === undefined || input.type === "tenant_purchase";
  const includeEvents = input.type === undefined || input.type !== "tenant_purchase";

  const [purchases, events] = await Promise.all([
    includePurchases ? listLandlordPurchaseActivity(landlordId, input, fetchWindow) : [],
    includeEvents ? listLandlordEventActivity(landlordId, input, fetchWindow) : [],
  ]);

  return [...purchases, ...events]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(offset, offset + limit);
}

async function listLandlordPurchaseActivity(
  landlordId: string,
  input: ListLandlordActivityInput,
  fetchWindow: number,
): Promise<LandlordActivityItem[]> {
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

  const rows = await db
    .select({
      meterNumber: meters.meterNumber,
      meterStatus: meters.status,
      meterType: meters.meterType,
      motherMeterNumber: motherMeters.motherMeterNumber,
      motherMeterType: motherMeters.type,
      mpesaReceiptNumber: transactions.mpesaReceiptNumber,
      occurredAt: transactions.completedAt,
      phoneNumber: transactions.phoneNumber,
      transactionId: transactions.transactionId,
      unitsPurchased: transactions.unitsPurchased,
      valueAmount: transactions.netAmount,
    })
    .from(transactions)
    .innerJoin(meters, eq(transactions.meterId, meters.id))
    .innerJoin(motherMeters, eq(meters.motherMeterId, motherMeters.id))
    .where(and(...filters))
    .orderBy(desc(transactions.completedAt), desc(transactions.createdAt))
    .limit(fetchWindow);

  return rows
    .filter(
      (
        row,
      ): row is typeof row & {
        occurredAt: NonNullable<typeof row.occurredAt>;
      } => row.occurredAt !== null,
    )
    .map((row) => ({
      amount: toNumber(row.valueAmount).toFixed(2),
      id: row.transactionId,
      kplcReceiptNumber: null,
      kplcToken: null,
      meter: {
        meterNumber: row.meterNumber,
        meterType: row.meterType,
        status: row.meterStatus,
      },
      motherMeter: {
        motherMeterNumber: row.motherMeterNumber,
        type: row.motherMeterType,
      },
      mpesaReceiptNumber: row.mpesaReceiptNumber,
      occurredAt: row.occurredAt.toISOString(),
      phoneNumber: row.phoneNumber,
      transactionId: row.transactionId,
      type: "tenant_purchase",
      unitsPurchased: toNumber(row.unitsPurchased).toFixed(4),
    }));
}

async function listLandlordEventActivity(
  landlordId: string,
  input: ListLandlordActivityInput,
  fetchWindow: number,
): Promise<LandlordActivityItem[]> {
  const filters = [eq(motherMeters.landlordId, landlordId)];
  if (input.motherMeterId) {
    filters.push(eq(motherMeters.id, input.motherMeterId));
  }
  if (input.propertyId) {
    filters.push(eq(motherMeters.propertyId, input.propertyId));
  }
  if (input.startDate) {
    filters.push(gte(motherMeterEvents.createdAt, new Date(input.startDate)));
  }
  if (input.endDate) {
    filters.push(lte(motherMeterEvents.createdAt, new Date(input.endDate)));
  }
  if (
    input.type === "bill_payment" ||
    input.type === "initial_deposit" ||
    input.type === "refill"
  ) {
    filters.push(eq(motherMeterEvents.eventType, input.type));
  }

  const rows = await db
    .select({
      eventType: motherMeterEvents.eventType,
      id: motherMeterEvents.id,
      kplcReceiptNumber: motherMeterEvents.kplcReceiptNumber,
      kplcToken: motherMeterEvents.kplcToken,
      motherMeterNumber: motherMeters.motherMeterNumber,
      motherMeterType: motherMeters.type,
      occurredAt: motherMeterEvents.createdAt,
      valueAmount: motherMeterEvents.amount,
    })
    .from(motherMeterEvents)
    .innerJoin(motherMeters, eq(motherMeterEvents.motherMeterId, motherMeters.id))
    .where(and(...filters))
    .orderBy(desc(motherMeterEvents.createdAt))
    .limit(fetchWindow);

  return rows.map((row) => ({
    amount: toNumber(row.valueAmount).toFixed(2),
    id: row.id,
    kplcReceiptNumber: row.kplcReceiptNumber,
    kplcToken: row.kplcToken,
    meter: null,
    motherMeter: {
      motherMeterNumber: row.motherMeterNumber,
      type: row.motherMeterType,
    },
    mpesaReceiptNumber: null,
    occurredAt: row.occurredAt.toISOString(),
    phoneNumber: null,
    transactionId: null,
    type: row.eventType,
    unitsPurchased: null,
  }));
}
