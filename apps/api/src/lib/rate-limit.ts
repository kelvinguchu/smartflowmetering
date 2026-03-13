import { createMiddleware } from "hono/factory";
import { env } from "../config";
import type { AppBindings } from "./auth-middleware";
import { createRateLimitStore } from "./rate-limit-store";

type RateLimitOptions = {
  max: number;
  durationMs: number;
  prefix: string;
  message: string;
};

const { store: rateLimitStore, memoryStore } = createRateLimitStore(env.REDIS_URL);

function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) {
    return cfIp.trim();
  }

  return "unknown";
}

function createRateLimitMiddleware(options: RateLimitOptions) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const now = Date.now();
    const key = `${options.prefix}:${clientIpFromHeaders(c.req.raw.headers)}`;
    const bucket = await rateLimitStore.increment(key, options.durationMs, now);

    const remaining = Math.max(options.max - bucket.count, 0);
    c.header("X-RateLimit-Limit", String(options.max));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      c.header("Retry-After", String(retryAfter));
      return c.json(
        {
          error: "Too Many Requests",
          message: options.message,
          retryAfter,
        },
        429,
      );
    }

    if (remaining < 10) {
      console.warn(`[Rate Limit Warning] IP approaching limit: ${c.req.url}`);
    }

    await next();
  });
}

export const globalRateLimit = createRateLimitMiddleware({
  max: 100,
  durationMs: 60 * 1000,
  prefix: "global",
  message: "Rate limit exceeded. Please try again later.",
});

export const authRateLimit = createRateLimitMiddleware({
  max: 10,
  durationMs: 60 * 1000,
  prefix: "auth",
  message: "Too many authentication attempts. Please wait before trying again.",
});

export const mpesaRateLimit = createRateLimitMiddleware({
  max: 1000,
  durationMs: 60 * 1000,
  prefix: "mpesa",
  message: "Rate limit exceeded for M-Pesa callbacks.",
});

export const stkPushRateLimit = createRateLimitMiddleware({
  max: 5,
  durationMs: 60 * 1000,
  prefix: "stk",
  message:
    "Too many payment requests. Please wait before initiating another payment.",
});

export const smsRateLimit = createRateLimitMiddleware({
  max: 10,
  durationMs: 60 * 1000,
  prefix: "sms",
  message: "Too many SMS requests. Please wait before trying again.",
});

export const applicationRateLimit = createRateLimitMiddleware({
  max: 10,
  durationMs: 60 * 1000,
  prefix: "application",
  message: "Too many application submissions. Please wait before trying again.",
});

export const rateLimitMiddleware = globalRateLimit;

setInterval(() => {
  memoryStore.pruneExpired(Date.now());
}, 60 * 1000).unref?.();
