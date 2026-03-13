/**
 * Money calculation utilities using fixed-precision arithmetic.
 * Amounts are represented as strings to preserve exact decimal formatting.
 */

const KES_SCALE = 2;
const RATE_SCALE = 4;
const UNITS_SCALE = 4;
const BASIS_POINTS_SCALE = 10_000;

export function calculateCommission(
  grossAmount: string,
  rate: number = 0.1
): string {
  const grossMinor = parseDecimalToInt(grossAmount, KES_SCALE);
  const rateBasisPoints = toBasisPoints(rate);
  const commissionMinor = divideAndRoundHalfUp(
    grossMinor * rateBasisPoints,
    BigInt(BASIS_POINTS_SCALE)
  );

  return formatScaledInt(commissionMinor, KES_SCALE);
}

export function calculateNetAmount(
  grossAmount: string,
  commissionRate: number = 0.1
): string {
  const grossMinor = parseDecimalToInt(grossAmount, KES_SCALE);
  const commissionMinor = parseDecimalToInt(
    calculateCommission(grossAmount, commissionRate),
    KES_SCALE
  );

  return formatScaledInt(grossMinor - commissionMinor, KES_SCALE);
}

export function calculateUnits(netAmount: string, ratePerKwh: string): string {
  const netMinor = parseDecimalToInt(netAmount, KES_SCALE);
  const rateMinor = parseDecimalToInt(ratePerKwh, RATE_SCALE);

  if (rateMinor <= 0n) {
    throw new Error("Rate per kWh must be greater than 0");
  }

  const unitsMinor = divideAndRoundHalfUp(
    netMinor * 1_000_000n,
    rateMinor
  );

  return formatScaledInt(unitsMinor, UNITS_SCALE);
}

export function calculateTransaction(
  grossAmount: string,
  ratePerKwh: string,
  commissionRate: number = 0.1
): {
  grossAmount: string;
  commissionAmount: string;
  netAmount: string;
  unitsPurchased: string;
  rateUsed: string;
} {
  const normalizedGross = formatScaledInt(
    parseDecimalToInt(grossAmount, KES_SCALE),
    KES_SCALE
  );
  const commission = calculateCommission(normalizedGross, commissionRate);
  const net = calculateNetAmount(normalizedGross, commissionRate);
  const units = calculateUnits(net, ratePerKwh);

  return {
    grossAmount: normalizedGross,
    commissionAmount: commission,
    netAmount: net,
    unitsPurchased: units,
    rateUsed: ratePerKwh,
  };
}

export function meetsMinimumAmount(
  amount: string,
  minimum: number = 30
): boolean {
  return (
    parseDecimalToInt(amount, KES_SCALE) >=
    divideAndRoundHalfUp(BigInt(Math.round(minimum * 100)), 1n)
  );
}

function toBasisPoints(rate: number): bigint {
  return BigInt(Math.round(rate * BASIS_POINTS_SCALE));
}

function divideAndRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new Error("Division by zero");
  }

  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const threshold = denominator < 0n ? -denominator : denominator;
  const absRemainder = remainder < 0n ? -remainder : remainder;

  if (absRemainder * 2n < threshold) {
    return quotient;
  }

  return numerator >= 0n ? quotient + 1n : quotient - 1n;
}

function parseDecimalToInt(value: string, scale: number): bigint {
  const normalized = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid decimal value: ${value}`);
  }

  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ""] = unsigned.split(".");
  const paddedFraction = fraction.padEnd(scale, "0").slice(0, scale);
  const combined = `${whole}${paddedFraction}`.replace(/^0+(?=\d)/, "");
  const parsed = BigInt(combined || "0");

  return negative ? -parsed : parsed;
}

function formatScaledInt(value: bigint, scale: number): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const digits = absolute.toString().padStart(scale + 1, "0");
  const integerPart = digits.slice(0, -scale) || "0";
  const fractionPart = digits.slice(-scale);
  const prefix = negative ? "-" : "";

  return `${prefix}${integerPart}.${fractionPart}`;
}
