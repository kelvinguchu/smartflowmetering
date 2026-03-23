export function sanitizeMpesaPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMpesaPayload(item));
  }

  if (value && typeof value === "object") {
    const namedValue = sanitizeNamedValuePair(value);
    if (namedValue) {
      return namedValue;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        sanitizeMpesaField(key, entryValue),
      ])
    );
  }

  return value;
}

function sanitizeMpesaField(key: string, value: unknown): unknown {
  if (value == null) {
    return value;
  }

  if (isPhoneLikeKey(key)) {
    return maskPhoneValue(value);
  }

  if (isNameLikeKey(key)) {
    return "[redacted]";
  }

  return sanitizeMpesaPayload(value);
}

function sanitizeNamedValuePair(
  value: object
): Record<string, unknown> | null {
  const candidate = value as Record<string, unknown>;
  const name = typeof candidate.Name === "string" ? candidate.Name : null;

  if (!name || !("Value" in candidate)) {
    return null;
  }

  return {
    ...candidate,
    Value: isPhoneLikeKey(name)
      ? maskPhoneValue(candidate.Value)
      : sanitizeMpesaPayload(candidate.Value),
  };
}

function isPhoneLikeKey(key: string): boolean {
  return /(?:msisdn|phone)/i.test(key);
}

function isNameLikeKey(key: string): boolean {
  return /(?:firstName|middleName|lastName)$/i.test(key);
}

function maskPhoneValue(value: unknown): unknown {
  const input = String(value);
  const digits = input.replaceAll(/\D/g, "");
  if (digits.length < 4) {
    return "[redacted]";
  }

  return `${"*".repeat(Math.max(digits.length - 4, 0))}${digits.slice(-4)}`;
}
