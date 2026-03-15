import {
  buildBaselineState,
  listScopedMotherMeters,
  listTimelineRows,
} from "./landlord-timeline.queries";
import type {
  LandlordTimelineInput,
  LandlordTimelineItem,
} from "./landlord-timeline.types";
import { applyRowToState, shapeTimelineItem } from "./landlord-timeline.utils";

export async function listLandlordTimeline(
  landlordId: string,
  input: LandlordTimelineInput,
): Promise<LandlordTimelineItem[]> {
  const motherMeterScope = await listScopedMotherMeters(landlordId, input);
  if (motherMeterScope.length === 0) {
    return [];
  }

  const motherMeterIds = motherMeterScope.map((item) => item.id);
  const baseline = await buildBaselineState(motherMeterIds, input.startDate);
  const rows = await listTimelineRows(landlordId, input, motherMeterIds);
  const orderedRows = [...rows].sort((left, right) => {
    const timeDelta = left.occurredAt.getTime() - right.occurredAt.getTime();
    if (timeDelta !== 0) {
      return timeDelta;
    }

    return left.referenceId.localeCompare(right.referenceId);
  });

  const timeline = orderedRows.map((row) => {
    const current = baseline.get(row.motherMeterId) ?? {
      companyPaymentsToUtility: 0,
      netSalesCollected: 0,
      utilityFundingLoaded: 0,
    };
    const next = applyRowToState(current, row);
    baseline.set(row.motherMeterId, next);
    return shapeTimelineItem(row, next);
  });

  return timeline.reverse();
}
