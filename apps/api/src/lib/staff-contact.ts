const ALLOWED_STAFF_EMAIL_DOMAINS = ["gmail.com", "smartmetering.africa"] as const;
export type AllowedStaffEmailDomain = (typeof ALLOWED_STAFF_EMAIL_DOMAINS)[number];
export type PreferredTwoFactorMethod = "sms" | "totp";

export function normalizeStaffEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowedStaffEmail(email: string): boolean {
  const normalizedEmail = normalizeStaffEmail(email);
  const [, domain = ""] = normalizedEmail.split("@");
  return ALLOWED_STAFF_EMAIL_DOMAINS.includes(domain as AllowedStaffEmailDomain);
}

export function normalizeKenyanPhoneNumber(phoneNumber: string): string {
  const digits = phoneNumber.replaceAll(/\D/g, "");

  if (/^0[17]\d{8}$/.test(digits)) {
    return `254${digits.slice(1)}`;
  }

  if (/^254[17]\d{8}$/.test(digits)) {
    return digits;
  }

  throw new Error("Phone number must be 0712345678 or 254712345678");
}

export function isAllowedKenyanPhoneNumber(phoneNumber: string): boolean {
  try {
    normalizeKenyanPhoneNumber(phoneNumber);
    return true;
  } catch {
    return false;
  }
}

export function normalizePreferredTwoFactorMethod(
  method: string | null | undefined,
): PreferredTwoFactorMethod {
  if (method === "totp") {
    return "totp";
  }

  return "sms";
}
