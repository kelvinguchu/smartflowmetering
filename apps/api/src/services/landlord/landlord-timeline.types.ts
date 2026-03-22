export interface LandlordTimelineItem {
  amount: string;
  meter: {
    meterNumber: string;
    meterType: "electricity" | "gas" | "water";
  } | null;
  motherMeter: {
    motherMeterNumber: string;
    property: {
      name: string;
    };
    type: "postpaid" | "prepaid";
  };
  occurredAt: string;
  transaction: {
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
