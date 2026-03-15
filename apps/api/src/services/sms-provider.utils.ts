export const SMS_REQUEST_TIMEOUT_MS = 10_000;

export type SmsJsonPrimitive = boolean | null | number | string;
export type SmsJsonValue = SmsJsonObject | SmsJsonPrimitive | SmsJsonValue[];
export interface SmsJsonObject {
  [key: string]: SmsJsonValue;
}

export function formatPhoneForSms(phoneNumber: string): string {
  const cleanedPhoneNumber = phoneNumber.replaceAll(/[^0-9+]/g, "");

  if (cleanedPhoneNumber.startsWith("+")) {
    return cleanedPhoneNumber.slice(1);
  }

  if (cleanedPhoneNumber.startsWith("0")) {
    return `254${cleanedPhoneNumber.slice(1)}`;
  }

  if (/^\d{9}$/.test(cleanedPhoneNumber)) {
    return `254${cleanedPhoneNumber}`;
  }

  return cleanedPhoneNumber;
}

export function getResponseValue(
  response: SmsJsonObject,
  keys: string[],
): string {
  for (const key of keys) {
    const value = response[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (typeof value === "number") {
      return String(value);
    }
  }

  return "";
}
