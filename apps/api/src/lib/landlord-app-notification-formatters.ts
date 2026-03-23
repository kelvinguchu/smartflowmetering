import type { LandlordDailyUsageSummary } from "../services/landlord/landlord-daily-usage-summary.types";

export function formatLandlordDailyUsageAppNotification(input: {
  summary: LandlordDailyUsageSummary;
  targetDate: string;
}) {
  return {
    message:
      `Daily purchase summary for ${input.targetDate}: ` +
      `${input.summary.transactionCount} purchases across ` +
      `${input.summary.motherMeterBuckets.size} mother meters, ` +
      `total KES ${input.summary.amountTotal.toFixed(2)}.`,
    title: "Daily usage summary",
  };
}

export function formatLandlordSubMeterPurchaseAppNotification(input: {
  amountPaid: string;
  meterNumber: string;
  motherMeterNumber: string;
  unitsPurchased: string;
}) {
  return {
    message:
      `Sub-meter ${input.meterNumber} purchased ` +
      `${input.unitsPurchased} units for KES ${input.amountPaid}. ` +
      `Mother meter ${input.motherMeterNumber} was used for the supply.`,
    title: "Sub-meter purchase recorded",
  };
}

export function formatLandlordPrepaidLowBalanceAppNotification(input: {
  estimatedBalance: number;
  lowBalanceThreshold: number;
  motherMeterNumber: string;
}) {
  return {
    message:
      `Mother meter ${input.motherMeterNumber} is below the configured low-balance ` +
      `threshold. Estimated balance is KES ${input.estimatedBalance.toFixed(2)} ` +
      `against threshold KES ${input.lowBalanceThreshold.toFixed(2)}.`,
    title: "Prepaid balance alert",
  };
}

export function formatLandlordMotherMeterEventAppNotification(input: {
  amount: string;
  eventType: "bill_payment" | "initial_deposit" | "refill";
  motherMeterNumber: string;
}) {
  const action =
    input.eventType === "bill_payment"
      ? "Utility bill payment was recorded"
      : input.eventType === "refill"
        ? "Mother meter refill was recorded"
        : "Initial mother meter deposit was recorded";

  return {
    message:
      `${action} for mother meter ${input.motherMeterNumber}. ` +
      `Amount: KES ${input.amount}.`,
    title: "Mother meter event recorded",
  };
}

