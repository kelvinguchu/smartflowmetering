// Utility functions for generating unique IDs

/**
 * Generate OHMKenya transaction ID
 * Format: OHM-YYYYMMDD-XXXXX (e.g., OHM-20251220-A3K9F)
 */
export function generateTransactionId(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replaceAll("-", "");
  const random = generateRandomString(5);
  return `OHM-${dateStr}-${random}`;
}

/**
 * Generate random alphanumeric string
 */
export function generateRandomString(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars (0, O, 1, I)
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Format phone number to international format (254...)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove any non-digit characters
  let cleaned = phone.replaceAll(/\D/g, "");

  // Handle different formats
  if (cleaned.startsWith("0")) {
    // Local format: 0712345678 -> 254712345678
    cleaned = "254" + cleaned.slice(1);
  } else if (cleaned.startsWith("7") || cleaned.startsWith("1")) {
    // Short format: 712345678 -> 254712345678
    cleaned = "254" + cleaned;
  } else if (cleaned.startsWith("+")) {
    // Already has + prefix
    cleaned = cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Validate Kenyan phone number
 */
export function isValidKenyanPhone(phone: string): boolean {
  const formatted = formatPhoneNumber(phone);
  // Must be 12 digits starting with 254
  return /^254[17]\d{8}$/.test(formatted);
}
