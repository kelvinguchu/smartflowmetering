/**
 * Rate Limiting Configuration for OHMKenya API
 *
 * This provides protection against:
 * - DDoS attacks
 * - Brute force attacks on authentication
 * - API abuse
 * - Resource exhaustion
 *
 * Different limits for different endpoint types:
 * - M-Pesa callbacks: Higher limits (Safaricom servers)
 * - Public endpoints: Standard limits
 * - Auth endpoints: Stricter limits (prevent brute force)
 * - Admin endpoints: Moderate limits (authenticated users)
 */

import { rateLimit } from "elysia-rate-limit";
import { Elysia } from "elysia";

// ============================================
// Rate Limit Configurations
// ============================================

/**
 * Global rate limit - applies to all endpoints
 * 100 requests per minute per IP (generous for normal use)
 */
export const globalRateLimit = rateLimit({
  max: 100,
  duration: 60 * 1000, // 1 minute
  generator: (req: Request) => {
    // Use X-Forwarded-For for proxied requests, fallback to connection IP
    const forwarded = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    return forwarded?.split(",")[0]?.trim() || realIp || "unknown";
  },
  errorResponse: new Response(
    JSON.stringify({
      error: "Too Many Requests",
      message: "Rate limit exceeded. Please try again later.",
      retryAfter: 60,
    }),
    {
      status: 429,
      headers: { "Content-Type": "application/json" },
    }
  ),
});

/**
 * Auth rate limit - stricter for login/registration
 * 10 attempts per minute per IP (prevents brute force)
 */
export const authRateLimit = rateLimit({
  max: 10,
  duration: 60 * 1000, // 1 minute
  generator: (req: Request) => {
    const forwarded = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    return `auth:${forwarded?.split(",")[0]?.trim() || realIp || "unknown"}`;
  },
  errorResponse: new Response(
    JSON.stringify({
      error: "Too Many Requests",
      message:
        "Too many authentication attempts. Please wait before trying again.",
      retryAfter: 60,
    }),
    {
      status: 429,
      headers: { "Content-Type": "application/json" },
    }
  ),
});

/**
 * M-Pesa callback rate limit - high limits for Safaricom servers
 * 1000 requests per minute (handles burst traffic)
 */
export const mpesaRateLimit = rateLimit({
  max: 1000,
  duration: 60 * 1000, // 1 minute
  generator: (req: Request) => {
    // M-Pesa callbacks come from Safaricom IPs
    const forwarded = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    return `mpesa:${forwarded?.split(",")[0]?.trim() || realIp || "unknown"}`;
  },
  errorResponse: new Response(
    JSON.stringify({
      error: "Too Many Requests",
      message: "Rate limit exceeded for M-Pesa callbacks.",
    }),
    {
      status: 429,
      headers: { "Content-Type": "application/json" },
    }
  ),
});

/**
 * STK Push rate limit - moderate limits per user
 * 5 STK push requests per minute per IP (prevents spam)
 */
export const stkPushRateLimit = rateLimit({
  max: 5,
  duration: 60 * 1000, // 1 minute
  generator: (req: Request) => {
    const forwarded = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    return `stk:${forwarded?.split(",")[0]?.trim() || realIp || "unknown"}`;
  },
  errorResponse: new Response(
    JSON.stringify({
      error: "Too Many Requests",
      message:
        "Too many payment requests. Please wait before initiating another payment.",
      retryAfter: 60,
    }),
    {
      status: 429,
      headers: { "Content-Type": "application/json" },
    }
  ),
});

/**
 * SMS rate limit - prevents SMS bombing
 * 10 SMS requests per minute per IP
 */
export const smsRateLimit = rateLimit({
  max: 10,
  duration: 60 * 1000, // 1 minute
  generator: (req: Request) => {
    const forwarded = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    return `sms:${forwarded?.split(",")[0]?.trim() || realIp || "unknown"}`;
  },
  errorResponse: new Response(
    JSON.stringify({
      error: "Too Many Requests",
      message: "Too many SMS requests. Please wait before trying again.",
      retryAfter: 60,
    }),
    {
      status: 429,
      headers: { "Content-Type": "application/json" },
    }
  ),
});

// ============================================
// Rate Limit Middleware Plugin
// ============================================

/**
 * Apply this to the main Elysia app for global rate limiting
 */
export const rateLimitMiddleware = new Elysia({ name: "rate-limit" })
  .use(globalRateLimit)
  .onBeforeHandle(({ request, set }) => {
    // Log rate-limited requests for monitoring
    const remaining = set.headers?.["X-RateLimit-Remaining"];
    if (remaining !== undefined && parseInt(remaining as string) < 10) {
      console.warn(`[Rate Limit Warning] IP approaching limit: ${request.url}`);
    }
  });
