import { createQueue, createWorker, QUEUE_NAMES } from "./connection";
import {
  processPayment,
  processTokenGeneration,
  processSmsDelivery,
} from "./processors";
import type {
  PaymentJob,
  TokenGenerationJob,
  SmsDeliveryJob,
} from "./types";

// ============================================================
// Queues (used to add jobs)
// ============================================================

export const paymentProcessingQueue = createQueue(
  QUEUE_NAMES.PAYMENT_PROCESSING
);
export const tokenGenerationQueue = createQueue(QUEUE_NAMES.TOKEN_GENERATION);
export const smsDeliveryQueue = createQueue(QUEUE_NAMES.SMS_DELIVERY);

// ============================================================
// Workers (process jobs)
// ============================================================

export const paymentWorker = createWorker<PaymentJob>(
  QUEUE_NAMES.PAYMENT_PROCESSING,
  processPayment,
  3 // Process 3 payments concurrently
);

export const tokenWorker = createWorker<TokenGenerationJob>(
  QUEUE_NAMES.TOKEN_GENERATION,
  processTokenGeneration,
  5 // Process 5 token requests concurrently
);

export const smsWorker = createWorker<SmsDeliveryJob>(
  QUEUE_NAMES.SMS_DELIVERY,
  processSmsDelivery,
  10 // Process 10 SMS concurrently
);

// ============================================================
// Worker Event Handlers
// ============================================================

// Payment Worker Events
paymentWorker.on("completed", (job) => {
  console.log(`[Payment Worker] Completed: ${job.id}`);
});

paymentWorker.on("failed", (job, error) => {
  console.error(`[Payment Worker] Failed: ${job?.id}`, error.message);
});

// Token Worker Events
tokenWorker.on("completed", (job) => {
  console.log(`[Token Worker] Completed: ${job.id}`);
});

tokenWorker.on("failed", (job, error) => {
  console.error(`[Token Worker] Failed: ${job?.id}`, error.message);
});

// SMS Worker Events
smsWorker.on("completed", (job) => {
  console.log(`[SMS Worker] Completed: ${job.id}`);
});

smsWorker.on("failed", (job, error) => {
  console.error(`[SMS Worker] Failed: ${job?.id}`, error.message);
});

// ============================================================
// Graceful Shutdown
// ============================================================

export async function closeAllQueues(): Promise<void> {
  console.log("[Queues] Shutting down...");

  await Promise.all([
    paymentWorker.close(),
    tokenWorker.close(),
    smsWorker.close(),
    paymentProcessingQueue.close(),
    tokenGenerationQueue.close(),
    smsDeliveryQueue.close(),
  ]);

  console.log("[Queues] All queues closed");
}

// ============================================================
// Queue Health Check
// ============================================================

export async function getQueueHealth(): Promise<{
  payment: { waiting: number; active: number; failed: number };
  token: { waiting: number; active: number; failed: number };
  sms: { waiting: number; active: number; failed: number };
}> {
  const [paymentCounts, tokenCounts, smsCounts] = await Promise.all([
    paymentProcessingQueue.getJobCounts("waiting", "active", "failed"),
    tokenGenerationQueue.getJobCounts("waiting", "active", "failed"),
    smsDeliveryQueue.getJobCounts("waiting", "active", "failed"),
  ]);

  return {
    payment: {
      waiting: paymentCounts.waiting ?? 0,
      active: paymentCounts.active ?? 0,
      failed: paymentCounts.failed ?? 0,
    },
    token: {
      waiting: tokenCounts.waiting ?? 0,
      active: tokenCounts.active ?? 0,
      failed: tokenCounts.failed ?? 0,
    },
    sms: {
      waiting: smsCounts.waiting ?? 0,
      active: smsCounts.active ?? 0,
      failed: smsCounts.failed ?? 0,
    },
  };
}

// ============================================================
// Re-exports
// ============================================================

export { QUEUE_NAMES, redisConnection } from "./connection";
export type * from "./types";
