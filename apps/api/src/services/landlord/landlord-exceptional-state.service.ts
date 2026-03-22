import {
  getLandlordMotherMeterRows,
  getMotherMeterEventAggregates,
} from "./landlord-dashboard.queries";
import type {
  LandlordExceptionalMotherMeterStateItem,
  LandlordExceptionalStateSummary,
} from "./landlord-exceptional-state.types";

const DEFAULT_COMPANY_PAYMENT_INACTIVITY_DAYS = 30;
const DEFAULT_POSTPAID_OUTSTANDING_THRESHOLD = 1000;

interface LandlordExceptionalStateInput {
  companyPaymentInactivityDays?: number;
  includeNominal?: boolean;
  postpaidOutstandingAmountThreshold?: number;
  propertyId?: string;
}

export async function getLandlordExceptionalStateSummary(
  landlordId: string,
  input: LandlordExceptionalStateInput,
): Promise<LandlordExceptionalStateSummary> {
  const states = await listLandlordExceptionalMotherMeterStates(landlordId, {
    ...input,
    includeNominal: true,
  });

  return {
    companyPayment: {
      staleCount: states.filter((item) => item.companyPaymentStatus.isStale).length,
    },
    postpaid: {
      largeOutstandingCount: states.filter(
        (item) => item.postpaidStatus?.isLargeOutstanding === true,
      ).length,
    },
    prepaid: {
      negativeBalanceCount: states.filter(
        (item) => item.prepaidStatus?.isNegativeBalance === true,
      ).length,
    },
    totalExceptionalMotherMeters: states.filter(hasAnyExceptionalState).length,
  };
}

export async function listLandlordExceptionalMotherMeterStates(
  landlordId: string,
  input: LandlordExceptionalStateInput,
): Promise<LandlordExceptionalMotherMeterStateItem[]> {
  const companyPaymentInactivityDays =
    input.companyPaymentInactivityDays ?? DEFAULT_COMPANY_PAYMENT_INACTIVITY_DAYS;
  const outstandingAmountThreshold =
    input.postpaidOutstandingAmountThreshold ??
    DEFAULT_POSTPAID_OUTSTANDING_THRESHOLD;

  const motherMeterRows = await getLandlordMotherMeterRows(
    landlordId,
    undefined,
    input.propertyId,
  );
  if (motherMeterRows.length === 0) {
    return [];
  }

  const aggregateMap = await getMotherMeterEventAggregates(
    motherMeterRows.map((row) => row.id),
  );

  const states = motherMeterRows.map<LandlordExceptionalMotherMeterStateItem>((row) => {
    const aggregate = aggregateMap.get(row.id) ?? {
      companyPaymentsToUtility: 0,
      lastBillPaymentAt: null,
      lastPurchaseAt: null,
      netSalesCollected: 0,
      utilityFundingLoaded: 0,
    };
    const prepaidEstimatedBalance =
      aggregate.utilityFundingLoaded -
      aggregate.companyPaymentsToUtility -
      aggregate.netSalesCollected;
    const postpaidOutstandingAmount = Math.max(
      aggregate.netSalesCollected - aggregate.companyPaymentsToUtility,
      0,
    );
    const daysSinceLastPayment =
      aggregate.lastBillPaymentAt === null
        ? null
        : diffInWholeDays(new Date(aggregate.lastBillPaymentAt));
    const isStaleCompanyPayment =
      daysSinceLastPayment === null
        ? true
        : daysSinceLastPayment >= companyPaymentInactivityDays;

    return {
      companyPaymentStatus: {
        daysSinceLastPayment,
        inactivityThresholdDays: companyPaymentInactivityDays,
        isStale: isStaleCompanyPayment,
        lastBillPaymentAt: aggregate.lastBillPaymentAt,
      },
      motherMeter: {
        motherMeterNumber: row.motherMeterNumber,
        type: row.type,
      },
      postpaidStatus:
        row.type === "postpaid"
          ? {
              isLargeOutstanding:
                postpaidOutstandingAmount >= outstandingAmountThreshold,
              outstandingAmount: postpaidOutstandingAmount.toFixed(2),
              outstandingAmountThreshold: outstandingAmountThreshold.toFixed(2),
            }
          : null,
      prepaidStatus:
        row.type === "prepaid"
          ? {
              estimatedBalance: prepaidEstimatedBalance.toFixed(2),
              isNegativeBalance: prepaidEstimatedBalance < 0,
            }
          : null,
    };
  });

  const filteredStates =
    input.includeNominal === true
      ? states
      : states.filter(hasAnyExceptionalState);

  return filteredStates.sort((left, right) =>
    left.motherMeter.motherMeterNumber.localeCompare(
      right.motherMeter.motherMeterNumber,
    ),
  );
}

export function getLandlordExceptionalStateDefaults() {
  return {
    companyPaymentInactivityDays: DEFAULT_COMPANY_PAYMENT_INACTIVITY_DAYS,
    postpaidOutstandingAmountThreshold:
      DEFAULT_POSTPAID_OUTSTANDING_THRESHOLD.toFixed(2),
  };
}

function diffInWholeDays(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function hasAnyExceptionalState(item: LandlordExceptionalMotherMeterStateItem) {
  return (
    item.companyPaymentStatus.isStale ||
    item.postpaidStatus?.isLargeOutstanding === true ||
    item.prepaidStatus?.isNegativeBalance === true
  );
}
