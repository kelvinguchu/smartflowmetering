import { Queue, Worker, type Job, type ConnectionOptions } from "bullmq";
import { env } from "../config";

// Parse Redis URL for BullMQ connection
function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number.parseInt(parsed.port, 10) || 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
  };
}

// Redis connection config
export const redisConnection: ConnectionOptions = parseRedisUrl(env.REDIS_URL);

// Queue names
export const QUEUE_NAMES = {
  PAYMENT_PROCESSING: "payment-processing",
  SMS_DELIVERY: "sms-delivery",
  TOKEN_GENERATION: "token-generation",
} as const;

// Default job options
export const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 1000, // Start with 1 second, then 2s, 4s, etc.
  },
  removeOnComplete: {
    age: 24 * 3600, // Keep completed jobs for 24 hours
    count: 1000, // Keep last 1000 completed jobs
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // Keep failed jobs for 7 days
  },
};

// Create a queue factory
export function createQueue(name: string): Queue {
  return new Queue(name, {
    connection: redisConnection,
    defaultJobOptions,
  });
}

// Create a worker factory
export function createWorker<T>(
  name: string,
  processor: (job: Job<T>) => Promise<unknown>,
  concurrency: number = 5
): Worker<T> {
  return new Worker<T>(name, processor, {
    connection: redisConnection,
    concurrency,
  });
}
