import type {
  BaseTimelineRow,
  LandlordTimelineItem,
  TimelineState,
} from "./landlord-timeline.types";

export function applyRowToState(
  state: TimelineState,
  row: BaseTimelineRow,
): TimelineState {
  if (row.eventType === "tenant_purchase") {
    return {
      ...state,
      netSalesCollected: state.netSalesCollected + row.amount,
    };
  }
  if (row.eventType === "bill_payment") {
    return {
      ...state,
      companyPaymentsToUtility: state.companyPaymentsToUtility + row.amount,
    };
  }

  return {
    ...state,
    utilityFundingLoaded: state.utilityFundingLoaded + row.amount,
  };
}

export function shapeTimelineItem(
  row: BaseTimelineRow,
  state: TimelineState,
): LandlordTimelineItem {
  const prepaidEstimatedBalance =
    state.utilityFundingLoaded -
    state.companyPaymentsToUtility -
    state.netSalesCollected;
  const postpaidOutstandingAmount = Math.max(
    state.netSalesCollected - state.companyPaymentsToUtility,
    0,
  );

  return {
    amount: row.amount.toFixed(2),
    financialSnapshot: {
      companyPaymentsToUtility: state.companyPaymentsToUtility.toFixed(2),
      netSalesCollected: state.netSalesCollected.toFixed(2),
      postpaidOutstandingAmount:
        row.motherMeterType === "postpaid"
          ? postpaidOutstandingAmount.toFixed(2)
          : null,
      prepaidEstimatedBalance:
        row.motherMeterType === "prepaid"
          ? prepaidEstimatedBalance.toFixed(2)
          : null,
      utilityFundingLoaded: state.utilityFundingLoaded.toFixed(2),
    },
    meter:
      row.meterId && row.meterNumber && row.meterType
        ? {
            id: row.meterId,
            meterNumber: row.meterNumber,
            meterType: row.meterType,
          }
        : null,
    motherMeter: {
      id: row.motherMeterId,
      motherMeterNumber: row.motherMeterNumber,
      property: {
        id: row.propertyId,
        name: row.propertyName,
      },
      type: row.motherMeterType,
    },
    occurredAt: row.occurredAt.toISOString(),
    referenceId: row.referenceId,
    transaction:
      row.eventType === "tenant_purchase" && row.phoneNumber && row.unitsPurchased !== null
        ? {
            mpesaReceiptNumber: row.mpesaReceiptNumber ?? "",
            phoneNumber: row.phoneNumber,
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
