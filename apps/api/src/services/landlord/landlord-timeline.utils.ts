import type {
  BaseTimelineRow,
  LandlordTimelineItem,
} from "./landlord-timeline.types";

export function shapeTimelineItem(row: BaseTimelineRow): LandlordTimelineItem {
  return {
    amount: row.amount.toFixed(2),
    meter:
      row.meterId && row.meterNumber && row.meterType
        ? {
            meterNumber: row.meterNumber,
            meterType: row.meterType,
          }
        : null,
    motherMeter: {
      motherMeterNumber: row.motherMeterNumber,
      property: {
        name: row.propertyName,
      },
      type: row.motherMeterType,
    },
    occurredAt: row.occurredAt.toISOString(),
    transaction:
      row.eventType === "tenant_purchase" && row.unitsPurchased !== null
        ? {
            unitsPurchased: row.unitsPurchased.toFixed(4),
          }
        : null,
    type: row.eventType,
  };
}

export function toNumber(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
