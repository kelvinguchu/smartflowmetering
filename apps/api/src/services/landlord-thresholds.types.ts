export interface LandlordThresholdSummary {
  postpaid: {
    dueCount: number;
    notDueCount: number;
  };
  prepaid: {
    aboveThresholdCount: number;
    belowThresholdCount: number;
  };
  propertyId: string | null;
}

export interface LandlordMotherMeterThresholdStateItem {
  motherMeter: {
    id: string;
    motherMeterNumber: string;
    property: {
      id: string;
    };
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
    id: string;
    motherMeterNumber: string;
    property: {
      id: string;
    };
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
