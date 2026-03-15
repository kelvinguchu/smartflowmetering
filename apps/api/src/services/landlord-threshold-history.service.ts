import {
  getScopedMotherMeter,
  getThresholdHistoryBaseline,
  listThresholdHistoryEventDays,
  listThresholdHistoryPurchaseDays,
} from "./landlord-threshold-history.queries";
import type { LandlordMotherMeterThresholdHistoryItem } from "./landlord-thresholds.types";

interface ThresholdHistoryInput {
  daysAfterLastPayment?: number;
  endDate?: string;
  startDate?: string;
}

export async function listLandlordMotherMeterThresholdHistory(
  landlordId: string,
  motherMeterId: string,
  input: ThresholdHistoryInput,
): Promise<LandlordMotherMeterThresholdHistoryItem[] | null> {
  const motherMeter = await getScopedMotherMeter(landlordId, motherMeterId);
  if (!motherMeter) {
    return null;
  }

  const range = normalizeRange(input.startDate, input.endDate);
  const [baseline, eventDays, purchaseDays] = await Promise.all([
    getThresholdHistoryBaseline(motherMeterId, range.startDate),
    listThresholdHistoryEventDays(motherMeterId, range),
    listThresholdHistoryPurchaseDays(motherMeterId, range),
  ]);

  const eventMap = new Map(eventDays.map((item) => [item.date, item]));
  const purchaseMap = new Map(purchaseDays.map((item) => [item.date, item]));
  const history: LandlordMotherMeterThresholdHistoryItem[] = [];

  let runningBillPayments = toNumber(baseline.billPayments);
  let runningNetSales = toNumber(baseline.netSales);
  let runningUtilityFunding = toNumber(baseline.utilityFundingLoaded);
  let lastBillPaymentAt = baseline.lastBillPaymentAt;

  for (const date of listDateKeys(range.startDate, range.endDate)) {
    const eventDay = eventMap.get(date);
    const purchaseDay = purchaseMap.get(date);

    if (eventDay) {
      runningBillPayments += toNumber(eventDay.billPayments);
      runningUtilityFunding += toNumber(eventDay.utilityFundingLoaded);
      if (eventDay.lastBillPaymentAt) {
        lastBillPaymentAt = eventDay.lastBillPaymentAt;
      }
    }
    if (purchaseDay) {
      runningNetSales += toNumber(purchaseDay.netSales);
    }

    history.push({
      date,
      motherMeter: {
        id: motherMeter.id,
        motherMeterNumber: motherMeter.motherMeterNumber,
        property: {
          id: motherMeter.propertyId,
        },
        type: motherMeter.type,
      },
      postpaidStatus:
        motherMeter.type === "postpaid"
          ? shapePostpaidStatus(date, lastBillPaymentAt, runningBillPayments, runningNetSales, input.daysAfterLastPayment)
          : null,
      prepaidStatus:
        motherMeter.type === "prepaid"
          ? shapePrepaidStatus(
              runningBillPayments,
              runningNetSales,
              runningUtilityFunding,
              motherMeter.lowBalanceThreshold,
            )
          : null,
    });
  }

  return history;
}

function shapePostpaidStatus(
  date: string,
  lastBillPaymentAt: Date | null,
  runningBillPayments: number,
  runningNetSales: number,
  daysAfterLastPayment = 13,
) {
  const outstandingAmount = Math.max(runningNetSales - runningBillPayments, 0);
  const currentDate = new Date(`${date}T00:00:00.000Z`);
  const reminderDate = lastBillPaymentAt
    ? addDays(lastBillPaymentAt, daysAfterLastPayment)
    : null;
  const daysSinceLastPayment = lastBillPaymentAt
    ? Math.floor((currentDate.getTime() - lastBillPaymentAt.getTime()) / 86_400_000)
    : null;

  return {
    daysSinceLastPayment,
    isReminderDue: reminderDate !== null && currentDate >= reminderDate,
    lastBillPaymentAt: lastBillPaymentAt?.toISOString() ?? null,
    outstandingAmount: outstandingAmount.toFixed(2),
    reminderDate: reminderDate?.toISOString() ?? null,
  };
}

function shapePrepaidStatus(
  runningBillPayments: number,
  runningNetSales: number,
  runningUtilityFunding: number,
  lowBalanceThreshold: string,
) {
  const threshold = toNumber(lowBalanceThreshold);
  const estimatedBalance = runningUtilityFunding - runningBillPayments - runningNetSales;

  return {
    estimatedBalance: estimatedBalance.toFixed(2),
    isBelowThreshold: estimatedBalance < threshold,
    lowBalanceThreshold: threshold.toFixed(2),
  };
}

function normalizeRange(startDate?: string, endDate?: string) {
  const end = endDate ?? todayKey();
  const start =
    startDate ??
    formatDate(addDays(new Date(`${end}T00:00:00.000Z`), -29));
  return {
    endDate: end,
    startDate: start,
  };
}

function listDateKeys(startDate: string, endDate: string): string[] {
  const items: string[] = [];
  let current = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (current <= end) {
    items.push(formatDate(current));
    current = addDays(current, 1);
  }

  return items;
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey(): string {
  return formatDate(new Date());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function toNumber(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
