import Redis from "ioredis";
import type { RedisOptions } from "ioredis";
import { parseRedisUrl } from "./redis-url";

export type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export interface RateLimitStore {
  increment(
    key: string,
    durationMs: number,
    now: number,
  ): Promise<RateLimitBucket>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, RateLimitBucket>();

  async increment(
    key: string,
    durationMs: number,
    now: number,
  ): Promise<RateLimitBucket> {
    const existing = this.buckets.get(key);
    const bucket =
      existing && existing.resetAt > now
        ? existing
        : { count: 0, resetAt: now + durationMs };

    bucket.count += 1;
    this.buckets.set(key, bucket);
    return { ...bucket };
  }

  pruneExpired(now: number) {
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}

class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly redis: Redis) {}

  async increment(
    key: string,
    durationMs: number,
    now: number,
  ): Promise<RateLimitBucket> {
    const result = await this.redis.eval(
      RATE_LIMIT_SCRIPT,
      1,
      key,
      String(durationMs),
    );
    const [countRaw, ttlRaw] = Array.isArray(result) ? result : [1, durationMs];
    const count = Number.parseInt(String(countRaw), 10) || 0;
    const ttlMs = Math.max(
      0,
      Number.parseInt(String(ttlRaw), 10) || durationMs,
    );

    return {
      count,
      resetAt: now + ttlMs,
    };
  }
}

export function createRateLimitStore(redisUrl: string): {
  store: RateLimitStore;
  memoryStore: MemoryRateLimitStore;
  close: () => Promise<void>;
} {
  const memoryStore = new MemoryRateLimitStore();
  const redis = new Redis({
    ...(parseRedisUrl(redisUrl) as RedisOptions),
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });
  const redisStore = new RedisRateLimitStore(redis);

  let fallbackUntil = 0;

  return {
    close: async () => {
      await redis.quit();
    },
    memoryStore,
    store: {
      async increment(key, durationMs, now) {
        if (now < fallbackUntil) {
          return memoryStore.increment(key, durationMs, now);
        }

        try {
          return await redisStore.increment(key, durationMs, now);
        } catch (error) {
          fallbackUntil = now + 60_000;
          console.error(
            "[Rate Limit] Redis unavailable, falling back to in-memory buckets for 60s",
            error,
          );
          return memoryStore.increment(key, durationMs, now);
        }
      },
    },
  };
}

const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;
