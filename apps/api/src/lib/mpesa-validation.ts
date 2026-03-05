import { env } from "../config";

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

/**
 * Extract client IP from request headers
 * Handles various proxy headers
 */
export function getClientIP(headers: Headers, server?: unknown): string | null {
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
