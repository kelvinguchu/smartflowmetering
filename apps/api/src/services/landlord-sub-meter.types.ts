import type { meterTypeEnum, meterStatusEnum } from "../db/schema/meters";
import type { motherMeterTypeEnum } from "../db/schema/mother-meters";

type MeterType = (typeof meterTypeEnum.enumValues)[number];
type MeterStatus = (typeof meterStatusEnum.enumValues)[number];
type MotherMeterType = (typeof motherMeterTypeEnum.enumValues)[number];

export interface LandlordSubMeterDetail {
  activity: {
    lastPurchaseAt: string | null;
    totalCompletedPurchases: number;
  };
  meterNumber: string;
  meterType: MeterType;
  motherMeter: {
    motherMeterNumber: string;
    type: MotherMeterType;
  };
  recentPurchases: LandlordSubMeterPurchaseItem[];
  status: MeterStatus;
  totals: {
    totalNetSales: string;
    totalUnitsPurchased: string;
  };
}

export interface LandlordSubMeterPurchaseItem {
  completedAt: string | null;
  meterCreditAmount: string;
  mpesaReceiptNumber: string;
  phoneNumber: string;
  transactionId: string;
  unitsPurchased: string;
}

export interface LandlordSubMeterTimelineItem {
  cumulativeNetSales: string;
  cumulativeUnitsPurchased: string;
  meterCreditAmount: string;
  occurredAt: string;
  unitsPurchased: string;
}
