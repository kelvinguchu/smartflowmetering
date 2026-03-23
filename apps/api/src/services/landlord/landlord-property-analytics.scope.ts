import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { motherMeters, properties } from "../../db/schema";

export interface ScopedLandlordPropertyAnalytics {
  motherMeters: {
    id: string;
    motherMeterNumber: string;
    type: "postpaid" | "prepaid";
  }[];
}

export async function getScopedLandlordPropertyAnalytics(
  landlordId: string,
  propertyId: string,
  motherMeterType?: "postpaid" | "prepaid",
): Promise<ScopedLandlordPropertyAnalytics | null> {
  const propertyRows = await db
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.landlordId, landlordId)))
    .limit(1);
  if (propertyRows.length === 0) {
    return null;
  }

  const filters = [eq(motherMeters.propertyId, propertyId)];
  if (motherMeterType) {
    filters.push(eq(motherMeters.type, motherMeterType));
  }

  const motherMeterRows = await db
    .select({
      id: motherMeters.id,
      motherMeterNumber: motherMeters.motherMeterNumber,
      type: motherMeters.type,
    })
    .from(motherMeters)
    .where(and(...filters));

  return {
    motherMeters: motherMeterRows,
  };
}
