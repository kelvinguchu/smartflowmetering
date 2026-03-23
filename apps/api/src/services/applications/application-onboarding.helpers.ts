import type { MeterApplication } from "../../db/schema";

export class ApplicationError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

type MeterTypeForApplication = "electricity" | "water";

export function normalizeSubMeterNumbers(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new ApplicationError(400, "subMeterNumbers must be an array");
  }

  const normalized = raw
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);

  if (normalized.length === 0) {
    throw new ApplicationError(400, "At least one sub meter number is required");
  }

  return [...new Set(normalized)];
}

export function mapUtilityType(
  utilityType: MeterApplication["utilityType"]
): MeterTypeForApplication {
  if (utilityType === "water") return "water";
  return "electricity";
}

export function formatDecimal(value: number, scale: number): string {
  return value.toFixed(scale);
}

export function normalizeOptionalString(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

export function buildDefaultPropertyName(application: MeterApplication): string {
  return `${application.firstName} ${application.lastName} Property`.trim();
}

