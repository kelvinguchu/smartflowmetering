import type { GomelongMeterType } from "./gomelong-client";

type MeterUtilityType = "electricity" | "water" | "gas";

export function mapMeterTypeToGomelong(
  meterType: MeterUtilityType,
): GomelongMeterType | null {
  if (meterType === "electricity") return 1;
  if (meterType === "water") return 2;
  return null;
}
