import { env } from "../config";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Known Safaricom M-Pesa IP ranges
 * Source: Safaricom Daraja API documentation and community knowledge
 * These should be verified with Safaricom for production use
 * 
 * Note: In production, also set MPESA_ALLOWED_IPS env var for additional IPs
 */
const KNOWN_SAFARICOM_IPS = [
  // Safaricom production IPs (verify with Safaricom before production)
  "196.201.214.",  // Range prefix
  "196.201.212.",  // Range prefix
  "196.201.213.",  // Range prefix
  "41.215.96.",    // Range prefix
  "41.215.97.",    // Range prefix
];

/**
 * Check if an IP address is from Safaricom's M-Pesa servers
 * 
 * @param ip - The IP address to validate
 * @returns true if the IP is from a known Safaricom range or in MPESA_ALLOWED_IPS
 */
export function isValidMpesaIP(ip: string | null | undefined): boolean {
  // In non-production, allow all IPs for testing
  if (env.NODE_ENV !== "production") {
    return true;
  }

  if (!ip) return false;

  // Clean the IP (remove ::ffff: prefix for IPv4-mapped IPv6)
  const cleanIP = ip.replace(/^::ffff:/, "");

  // Check against known Safaricom IP ranges
  for (const prefix of KNOWN_SAFARICOM_IPS) {
    if (cleanIP.startsWith(prefix)) {
      return true;
    }
  }

  // Check against configured allowed IPs
  if (env.MPESA_ALLOWED_IPS.length > 0) {
    if (env.MPESA_ALLOWED_IPS.includes(cleanIP)) {
      return true;
    }
    // Also check with prefix matching for configured ranges
    for (const allowedIP of env.MPESA_ALLOWED_IPS) {
      if (allowedIP.endsWith(".") && cleanIP.startsWith(allowedIP)) {
        return true;
      }
    }
  }

  return false;
}

export interface MpesaSignatureValidationResult {
  valid: boolean;
  reason?: string;
}

export async function validateMpesaSignature(
  request: Request
): Promise<MpesaSignatureValidationResult> {
  const enforceSignature = env.MPESA_REQUIRE_SIGNATURE;
  const secret = env.MPESA_SIGNATURE_SECRET;

  if (!secret) {
    if (enforceSignature) {
      return { valid: false, reason: "Signature secret is not configured" };
    }
    return { valid: true };
  }

  const signatureHeader = request.headers.get(env.MPESA_SIGNATURE_HEADER);
  if (!signatureHeader) {
    if (enforceSignature) {
      return {
        valid: false,
        reason: `Missing signature header: ${env.MPESA_SIGNATURE_HEADER}`,
      };
    }
    return { valid: true };
  }

  const providedSignature = normalizeSignature(signatureHeader);
  if (!providedSignature) {
    return { valid: false, reason: "Invalid signature format" };
  }

  const timestampHeader = request.headers.get(
    env.MPESA_SIGNATURE_TIMESTAMP_HEADER
  );
  if (timestampHeader) {
    const timestampMs = parseTimestamp(timestampHeader);
    if (!timestampMs) {
      return { valid: false, reason: "Invalid signature timestamp" };
    }

    const ageMs = Math.abs(Date.now() - timestampMs);
    if (ageMs > env.MPESA_SIGNATURE_MAX_AGE_SECONDS * 1000) {
      return { valid: false, reason: "Signature timestamp expired" };
    }
  }

  const rawBody = await request.clone().text();
  const payload = timestampHeader ? `${timestampHeader}.${rawBody}` : rawBody;
  const expectedSignature = createHmac("sha256", secret).update(payload).digest();

  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return { valid: false, reason: "Signature mismatch" };
  }

  return { valid: true };
}

/**
 * Extract client IP from request headers
 * Handles various proxy headers
 */
export function getClientIP(headers: Headers): string | null {
  // Check X-Forwarded-For (common proxy header)
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // Take the first IP (original client)
    return forwarded.split(",")[0].trim();
  }

  // Check X-Real-IP (nginx)
  const realIP = headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }

  // Check CF-Connecting-IP (Cloudflare)
  const cfIP = headers.get("cf-connecting-ip");
  if (cfIP) {
    return cfIP.trim();
  }

  // Fallback: requires runtime-specific socket access (not implemented)
  return null;
}

function normalizeSignature(value: string): Buffer | null {
  const trimmed = value.trim();
  const withoutPrefix = trimmed.replace(/^(sha256|v1)=/i, "");

  if (/^[a-f0-9]{64}$/i.test(withoutPrefix)) {
    return Buffer.from(withoutPrefix, "hex");
  }

  try {
    const asBuffer = Buffer.from(withoutPrefix, "base64");
    if (asBuffer.length === 32) return asBuffer;
  } catch {
    // no-op
  }

  return null;
}

function parseTimestamp(value: string): number | null {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const numeric = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(numeric)) return null;
    return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  }

  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
