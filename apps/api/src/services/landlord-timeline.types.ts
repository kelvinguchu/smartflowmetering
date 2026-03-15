export interface LandlordTimelineItem {
  amount: string;
  financialSnapshot: {
    companyPaymentsToUtility: string;
    netSalesCollected: string;
    postpaidOutstandingAmount: string | null;
    prepaidEstimatedBalance: string | null;
    utilityFundingLoaded: string;
  };
  meter: {
    id: string;
    meterNumber: string;
    meterType: "electricity" | "gas" | "water";
  } | null;
  motherMeter: {
    id: string;
    motherMeterNumber: string;
    property: {
      id: string;
      name: string;
    };
    type: "postpaid" | "prepaid";
  };
  occurredAt: string;
  referenceId: string;
  transaction: {
    mpesaReceiptNumber: string;
    phoneNumber: string;
    unitsPurchased: string;
  } | null;
  type: "bill_payment" | "initial_deposit" | "refill" | "tenant_purchase";
}

export interface LandlordTimelineInput {
  endDate?: string;
  limit?: number;
  motherMeterId?: string;
  offset?: number;
  propertyId?: string;
  startDate?: string;
}

export interface TimelineState {
  companyPaymentsToUtility: number;
  netSalesCollected: number;
  utilityFundingLoaded: number;
}

export interface BaseTimelineRow {
  amount: number;
  eventType: "bill_payment" | "initial_deposit" | "refill" | "tenant_purchase";
  meterId: string | null;
  meterNumber: string | null;
  meterType: "electricity" | "gas" | "water" | null;
  motherMeterId: string;
  motherMeterNumber: string;
  motherMeterType: "postpaid" | "prepaid";
  mpesaReceiptNumber: string | null;
  occurredAt: Date;
  phoneNumber: string | null;
  propertyId: string;
  propertyName: string;
  referenceId: string;
  unitsPurchased: number | null;
}
