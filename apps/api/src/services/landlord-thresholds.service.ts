import type {
  LandlordMotherMeterThresholdStateItem,
  LandlordThresholdSummary,
} from "./landlord-thresholds.types";
import {
  listMotherMeterLowBalanceAlerts,
  listPostpaidPaymentReminders,
} from "./mother-meter-analytics.service";

interface ThresholdQueryInput {
  daysAfterLastPayment?: number;
  includeNominal?: boolean;
  propertyId?: string;
}

export async function getLandlordThresholdSummary(
  landlordId: string,
  input: ThresholdQueryInput,
): Promise<LandlordThresholdSummary> {
  const [prepaidAlerts, postpaidReminders] = await Promise.all([
    listMotherMeterLowBalanceAlerts({
      includeAboveThreshold: true,
      landlordId,
      propertyId: input.propertyId,
    }),
    listPostpaidPaymentReminders({
      daysAfterLastPayment: input.daysAfterLastPayment,
      includeNotDue: true,
      landlordId,
      propertyId: input.propertyId,
    }),
  ]);
  const prepaidThresholds = prepaidAlerts.filter((item) => item.type === "prepaid");

  return {
    postpaid: {
      dueCount: postpaidReminders.filter((item) => item.isReminderDue).length,
      notDueCount: postpaidReminders.filter((item) => !item.isReminderDue).length,
    },
    prepaid: {
      aboveThresholdCount: prepaidThresholds.filter((item) => !item.isBelowThreshold).length,
      belowThresholdCount: prepaidThresholds.filter((item) => item.isBelowThreshold).length,
    },
  };
}

export async function listLandlordMotherMeterThresholdStates(
  landlordId: string,
  input: ThresholdQueryInput,
): Promise<LandlordMotherMeterThresholdStateItem[]> {
  const [prepaidAlerts, postpaidReminders] = await Promise.all([
    listMotherMeterLowBalanceAlerts({
      includeAboveThreshold: input.includeNominal ?? false,
      landlordId,
      propertyId: input.propertyId,
    }),
    listPostpaidPaymentReminders({
      daysAfterLastPayment: input.daysAfterLastPayment,
      includeNotDue: input.includeNominal ?? false,
      landlordId,
      propertyId: input.propertyId,
    }),
  ]);
  const prepaidThresholds = prepaidAlerts.filter((item) => item.type === "prepaid");

  const states = new Map<string, LandlordMotherMeterThresholdStateItem>();

  for (const alert of prepaidThresholds) {
    states.set(alert.motherMeterId, {
      motherMeter: {
        motherMeterNumber: alert.motherMeterNumber,
        type: alert.type,
      },
      postpaidStatus: null,
      prepaidStatus: {
        estimatedBalance: alert.estimatedBalance.toFixed(2),
        isBelowThreshold: alert.isBelowThreshold,
        lowBalanceThreshold: alert.lowBalanceThreshold.toFixed(2),
      },
    });
  }

  for (const reminder of postpaidReminders) {
    states.set(reminder.motherMeterId, {
      motherMeter: {
        motherMeterNumber: reminder.motherMeterNumber,
        type: "postpaid",
      },
      postpaidStatus: {
        daysSinceLastPayment: reminder.daysSinceLastPayment,
        isReminderDue: reminder.isReminderDue,
        lastBillPaymentAt: reminder.lastBillPaymentAt?.toISOString() ?? null,
        reminderDate: reminder.reminderDate?.toISOString() ?? null,
      },
      prepaidStatus: null,
    });
  }

  return [...states.values()].sort((left, right) =>
    left.motherMeter.motherMeterNumber.localeCompare(right.motherMeter.motherMeterNumber),
  );
}
