function maskValue(
  value: string,
  visibleStart: number,
  visibleEnd: number,
): string {
  if (!value) return "";
  if (value.length <= visibleStart + visibleEnd) {
    return "*".repeat(value.length);
  }

  return `${value.slice(0, visibleStart)}${"*".repeat(
    value.length - visibleStart - visibleEnd,
  )}${value.slice(-visibleEnd)}`;
}

export function sanitizeUrlForLog(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return url.split("?")[0] ?? url;
  }
}

export function maskPhoneForLog(phoneNumber: string): string {
  const normalized = phoneNumber.trim();
  return maskValue(normalized, 4, 2);
}

export function maskMeterNumberForLog(meterNumber: string): string {
  const normalized = meterNumber.trim();
  return maskValue(normalized, 2, 2);
}

export function maskReferenceForLog(reference: string): string {
  const normalized = reference.trim();
  return maskValue(normalized, 3, 3);
}
