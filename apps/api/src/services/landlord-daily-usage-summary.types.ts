export interface MotherMeterUsageSummary {
  amountTotal: number;
  motherMeterId: string;
  motherMeterNumber: string;
  subMeters: Set<string>;
  transactionCount: number;
  unitsTotal: number;
}

export interface LandlordDailyUsageSummary {
  amountTotal: number;
  landlordId: string;
  landlordName: string;
  motherMeterBuckets: Map<string, MotherMeterUsageSummary>;
  phoneNumber: string;
  transactionCount: number;
  unitsTotal: number;
}
