export interface LandlordThresholdSummary {
  postpaid: {
    dueCount: number;
    notDueCount: number;
  };
  prepaid: {
    aboveThresholdCount: number;
    belowThresholdCount: number;
  };
}

export interface LandlordMotherMeterThresholdStateItem {
  motherMeter: {
    motherMeterNumber: string;
    type: "postpaid" | "prepaid";
  };
  postpaidStatus: {
    daysSinceLastPayment: number | null;
    isReminderDue: boolean;
    lastBillPaymentAt: string | null;
    reminderDate: string | null;
  } | null;
  prepaidStatus: {
    estimatedBalance: string;
    isBelowThreshold: boolean;
    lowBalanceThreshold: string;
  } | null;
}

export interface LandlordMotherMeterThresholdHistoryItem {
  date: string;
  motherMeter: {
    motherMeterNumber: string;
    type: "postpaid" | "prepaid";
  };
  postpaidStatus: {
    daysSinceLastPayment: number | null;
    isReminderDue: boolean;
    lastBillPaymentAt: string | null;
    outstandingAmount: string;
    reminderDate: string | null;
  } | null;
  prepaidStatus: {
    estimatedBalance: string;
    isBelowThreshold: boolean;
    lowBalanceThreshold: string;
  } | null;
}
