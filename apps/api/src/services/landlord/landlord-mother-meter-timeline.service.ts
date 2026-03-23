import { getLandlordMotherMeterRows } from "./landlord-dashboard.queries";
import { listLandlordTimeline } from "./landlord-timeline.service";
import type {
  LandlordTimelineInput,
  LandlordTimelineItem,
} from "./landlord-timeline.types";

export async function getLandlordMotherMeterTimeline(
  landlordId: string,
  motherMeterId: string,
  input: Omit<LandlordTimelineInput, "motherMeterId" | "propertyId">,
): Promise<LandlordTimelineItem[] | null> {
  const motherMeterRows = await getLandlordMotherMeterRows(landlordId, motherMeterId);
  if (motherMeterRows.length === 0) {
    return null;
  }

  return listLandlordTimeline(landlordId, {
    endDate: input.endDate,
    limit: input.limit,
    motherMeterId,
    offset: input.offset,
    startDate: input.startDate,
  });
}
