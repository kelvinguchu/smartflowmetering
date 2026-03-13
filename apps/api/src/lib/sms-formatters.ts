/**
 * Pure SMS formatting utilities — no env/DB imports.
 */

interface TokenSmsInput {
  meterNumber: string;
  token: string;
  transactionDate: Date;
  timezone: string;
  units: string;
  amountPaid: string;
  tokenAmount: string;
  otherCharges: string;
}

export type { TokenSmsInput };

function formatTokenGroups(token: string): string {
  const digitsOnly = token.replaceAll(/\D/g, "");
  const source = digitsOnly || token;
  const grouped = source.replaceAll(/(.{4})/g, "$1-");
  return grouped.endsWith("-") ? grouped.slice(0, -1) : grouped;
}

function formatSmsDateTime(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";

  return `${year}${month}${day} ${hour}:${minute}`;
}

function formatUnits(units: string): string {
  const parsedUnits = Number.parseFloat(units);
  if (!Number.isFinite(parsedUnits)) {
    return units;
  }
  return parsedUnits.toString();
}

function formatMoney(amount: string): string {
  const parsedAmount = Number.parseFloat(amount);
  if (!Number.isFinite(parsedAmount)) {
    return amount;
  }
  return parsedAmount.toFixed(2);
}

export function formatTokenSms(input: TokenSmsInput): string {
  const formattedToken = formatTokenGroups(input.token);
  const formattedDate = formatSmsDateTime(
    input.transactionDate,
    input.timezone,
  );

  return `Mtr:${input.meterNumber}
Token:${formattedToken}
Date:${formattedDate}
Units:${formatUnits(input.units)}
Amt:${formatMoney(input.amountPaid)}
TknAmt:${formatMoney(input.tokenAmount)}
OtherCharges:${formatMoney(input.otherCharges)}`;
}

export function formatOnboardingApprovedSms(input: {
  landlordName: string;
  motherMeterNumber: string;
  subMeterCount: number;
}): string {
  return `Smart Flow Metering: Hello ${input.landlordName}, your meter application has been approved.
Mother meter: ${input.motherMeterNumber}
Registered sub-meters: ${input.subMeterCount}
You can now start vending tokens.`;
}

export function formatAdminTokenSms(input: {
  meterNumber: string;
  token: string;
  tokenType: "clear_tamper" | "clear_credit" | "set_power_limit" | "key_change";
  power?: number;
  sgcId?: string;
}): string {
  const actionLine = getAdminTokenActionLabel(
    input.tokenType,
    input.power,
    input.sgcId,
  );

  return `Smart Flow Metering
Meter:${input.meterNumber}
Action:${actionLine}
Token:${formatTokenGroups(input.token)}
Keep this token secure.`;
}

function getAdminTokenActionLabel(
  tokenType: "clear_tamper" | "clear_credit" | "set_power_limit" | "key_change",
  power?: number,
  sgcId?: string,
): string {
  if (tokenType === "clear_tamper") {
    return "Clear Tamper";
  }
  if (tokenType === "clear_credit") {
    return "Clear Credit";
  }
  if (tokenType === "set_power_limit") {
    return power ? `Set Power ${power}W` : "Set Power Limit";
  }

  return sgcId ? `Key Change ${sgcId}` : "Key Change";
}

export function formatFailedPurchaseFollowUpSms(input: {
  amount: string;
  meterNumber: string;
}): string {
  return `Smart Flow Metering: We could not complete your token purchase for meter ${input.meterNumber}.
Amount received: KES ${formatMoney(input.amount)}
Please try again or contact support if you need help.`;
}

export function formatBuyTokenNudgeSms(input: {
  meterNumber: string;
}): string {
  return `Smart Flow Metering: Meter ${input.meterNumber} has no recent token purchase.
Buy tokens early to avoid interruption.`;
}
