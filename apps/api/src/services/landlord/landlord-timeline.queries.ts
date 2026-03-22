import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "../../db";
import {
  meters,
  motherMeterEvents,
  motherMeters,
  properties,
  transactions,
} from "../../db/schema";
import type {
  BaseTimelineRow,
  LandlordTimelineInput,
} from "./landlord-timeline.types";
import { toNumber } from "./landlord-timeline.utils";

export async function listScopedMotherMeters(
  landlordId: string,
  input: LandlordTimelineInput,
) {
  const filters = [eq(motherMeters.landlordId, landlordId)];
  if (input.motherMeterId) {
    filters.push(eq(motherMeters.id, input.motherMeterId));
  }
  if (input.propertyId) {
    filters.push(eq(motherMeters.propertyId, input.propertyId));
  }

  return db
    .select({ id: motherMeters.id })
    .from(motherMeters)
    .where(and(...filters));
}

export async function listTimelineRows(
  landlordId: string,
  input: LandlordTimelineInput,
  motherMeterIds: string[],
): Promise<BaseTimelineRow[]> {
  const start = input.startDate ? new Date(input.startDate) : null;
  const end = input.endDate ? new Date(input.endDate) : null;
  const purchaseFilters = [
    eq(motherMeters.landlordId, landlordId),
    inArray(motherMeters.id, motherMeterIds),
    eq(transactions.status, "completed"),
  ];
  const eventFilters = [
    eq(motherMeters.landlordId, landlordId),
    inArray(motherMeters.id, motherMeterIds),
  ];
  if (start) {
    purchaseFilters.push(gte(transactions.completedAt, start));
    eventFilters.push(gte(motherMeterEvents.createdAt, start));
  }
  if (end) {
    purchaseFilters.push(lte(transactions.completedAt, end));
    eventFilters.push(lte(motherMeterEvents.createdAt, end));
  }

  const fetchWindow = (input.limit ?? 50) + (input.offset ?? 0);
  const [purchaseRows, eventRows] = await Promise.all([
    db
      .select({
        amount: transactions.netAmount,
        meterId: meters.id,
        meterNumber: meters.meterNumber,
        meterType: meters.meterType,
        motherMeterId: motherMeters.id,
        motherMeterNumber: motherMeters.motherMeterNumber,
        motherMeterType: motherMeters.type,
        mpesaReceiptNumber: transactions.mpesaReceiptNumber,
        occurredAt: transactions.completedAt,
        phoneNumber: transactions.phoneNumber,
        propertyId: properties.id,
        propertyName: properties.name,
        referenceId: transactions.transactionId,
        unitsPurchased: transactions.unitsPurchased,
      })
      .from(transactions)
      .innerJoin(meters, eq(transactions.meterId, meters.id))
      .innerJoin(motherMeters, eq(meters.motherMeterId, motherMeters.id))
      .innerJoin(properties, eq(motherMeters.propertyId, properties.id))
      .where(and(...purchaseFilters))
      .orderBy(desc(transactions.completedAt), desc(transactions.createdAt))
      .limit(fetchWindow),
    db
      .select({
        amount: motherMeterEvents.amount,
        eventType: motherMeterEvents.eventType,
        motherMeterId: motherMeters.id,
        motherMeterNumber: motherMeters.motherMeterNumber,
        motherMeterType: motherMeters.type,
        occurredAt: motherMeterEvents.createdAt,
        propertyId: properties.id,
        propertyName: properties.name,
        referenceId: motherMeterEvents.id,
      })
      .from(motherMeterEvents)
      .innerJoin(motherMeters, eq(motherMeterEvents.motherMeterId, motherMeters.id))
      .innerJoin(properties, eq(motherMeters.propertyId, properties.id))
      .where(and(...eventFilters))
      .orderBy(desc(motherMeterEvents.createdAt))
      .limit(fetchWindow),
  ]);

  const rows: BaseTimelineRow[] = [
    ...purchaseRows
      .filter((row): row is typeof row & { occurredAt: Date } => row.occurredAt !== null)
      .map((row) => ({
        amount: toNumber(row.amount),
        eventType: "tenant_purchase" as const,
        meterId: row.meterId,
        meterNumber: row.meterNumber,
        meterType: row.meterType,
        motherMeterId: row.motherMeterId,
        motherMeterNumber: row.motherMeterNumber,
        motherMeterType: row.motherMeterType,
        mpesaReceiptNumber: row.mpesaReceiptNumber,
        occurredAt: row.occurredAt,
        phoneNumber: row.phoneNumber,
        propertyId: row.propertyId,
        propertyName: row.propertyName,
        referenceId: row.referenceId,
        unitsPurchased: toNumber(row.unitsPurchased),
      })),
    ...eventRows.map((row) => ({
      amount: toNumber(row.amount),
      eventType: row.eventType,
      meterId: null,
      meterNumber: null,
      meterType: null,
      motherMeterId: row.motherMeterId,
      motherMeterNumber: row.motherMeterNumber,
      motherMeterType: row.motherMeterType,
      mpesaReceiptNumber: null,
      occurredAt: row.occurredAt,
      phoneNumber: null,
      propertyId: row.propertyId,
      propertyName: row.propertyName,
      referenceId: row.referenceId,
      unitsPurchased: null,
    })),
  ];

  return rows
    .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
    .slice(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? 50));
}
