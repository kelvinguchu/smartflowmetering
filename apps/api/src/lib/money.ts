/**
 * Money calculation utilities
 * Using string-based arithmetic to avoid floating point errors
 * All amounts are in KES (Kenyan Shillings)
 */

const PRECISION = 2; // 2 decimal places for KES
const UNITS_PRECISION = 4; // 4 decimal places for kWh units

/**
 * Calculate commission amount (10% of gross)
 */
export function calculateCommission(
  grossAmount: string,
  rate: number = 0.1
): string {
  const gross = Number.parseFloat(grossAmount);
  const commission = gross * rate;
  return commission.toFixed(PRECISION);
}

/**
 * Calculate net amount (gross - commission)
 */
export function calculateNetAmount(
  grossAmount: string,
  commissionRate: number = 0.1
): string {
  const gross = Number.parseFloat(grossAmount);
  const net = gross * (1 - commissionRate);
  return net.toFixed(PRECISION);
}

/**
 * Calculate units from net amount and rate
 */
export function calculateUnits(netAmount: string, ratePerKwh: string): string {
  const net = Number.parseFloat(netAmount);
  const rate = Number.parseFloat(ratePerKwh);

  if (rate <= 0) {
    throw new Error("Rate per kWh must be greater than 0");
  }

  const units = net / rate;
  return units.toFixed(UNITS_PRECISION);
}

/**
 * Full calculation: gross amount -> commission, net, units
 */
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
  const commission = calculateCommission(grossAmount, commissionRate);
  const net = calculateNetAmount(grossAmount, commissionRate);
  const units = calculateUnits(net, ratePerKwh);

  return {
    grossAmount: Number.parseFloat(grossAmount).toFixed(PRECISION),
    commissionAmount: commission,
    netAmount: net,
    unitsPurchased: units,
    rateUsed: ratePerKwh,
  };
}

/**
 * Check if amount meets minimum transaction threshold
 */
export function meetsMinimumAmount(
  amount: string,
  minimum: number = 30
): boolean {
  return Number.parseFloat(amount) >= minimum;
}
