import type { meterTypeEnum, meterStatusEnum } from "../db/schema/meters";
import type { motherMeterTypeEnum } from "../db/schema/mother-meters";

export type LandlordActivityType =
  | "bill_payment"
  | "initial_deposit"
  | "refill"
  | "tenant_purchase";

type MeterType = (typeof meterTypeEnum.enumValues)[number];
type MeterStatus = (typeof meterStatusEnum.enumValues)[number];
type MotherMeterType = (typeof motherMeterTypeEnum.enumValues)[number];

export interface LandlordActivityItem {
  amount: string;
  id: string;
  kplcReceiptNumber: string | null;
  kplcToken: string | null;
  meter: {
    meterNumber: string;
    meterType: MeterType;
    status: MeterStatus;
  } | null;
  motherMeter: {
    motherMeterNumber: string;
    type: MotherMeterType;
  };
  mpesaReceiptNumber: string | null;
  occurredAt: string;
  phoneNumber: string | null;
  transactionId: string | null;
  type: LandlordActivityType;
  unitsPurchased: string | null;
}
