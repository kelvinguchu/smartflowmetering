import type { Worker } from "bullmq";
import { createQueue, createWorker, QUEUE_NAMES } from "./connection";
import {
  processAppNotificationDelivery,
  processPayment,
  processTokenGeneration,
  processSmsDelivery,
} from "./processors";
import type {
  AppNotificationDeliveryJob,
  PaymentJob,
  TokenGenerationJob,
  SmsJob,
} from "./types";

// ============================================================
// Queues (used to add jobs)
// ============================================================

export const paymentProcessingQueue = createQueue(
  QUEUE_NAMES.PAYMENT_PROCESSING,
);
export const appNotificationDeliveryQueue = createQueue(
  QUEUE_NAMES.APP_NOTIFICATION_DELIVERY,
);
export const tokenGenerationQueue = createQueue(QUEUE_NAMES.TOKEN_GENERATION);
export const smsDeliveryQueue = createQueue(QUEUE_NAMES.SMS_DELIVERY);

// ============================================================
// Workers (process jobs)
// ============================================================

let paymentWorker: Worker<
  PaymentJob,
  Awaited<ReturnType<typeof processPayment>>
> | null = null;
let appNotificationWorker: Worker<
  AppNotificationDeliveryJob,
  Awaited<ReturnType<typeof processAppNotificationDelivery>>
> | null = null;
let tokenWorker: Worker<
  TokenGenerationJob,
  Awaited<ReturnType<typeof processTokenGeneration>>
> | null = null;
let smsWorker: Worker<
  SmsJob,
  Awaited<ReturnType<typeof processSmsDelivery>>
> | null = null;

export async function startQueueWorkers(): Promise<void> {
  if (paymentWorker && appNotificationWorker && tokenWorker && smsWorker) {
    await Promise.all([
      paymentWorker.waitUntilReady(),
      appNotificationWorker.waitUntilReady(),
      tokenWorker.waitUntilReady(),
      smsWorker.waitUntilReady(),
    ]);
    return;
  }

  paymentWorker = createWorker(
    QUEUE_NAMES.PAYMENT_PROCESSING,
    processPayment,
    3,
  );
  appNotificationWorker = createWorker(
    QUEUE_NAMES.APP_NOTIFICATION_DELIVERY,
    processAppNotificationDelivery,
    5,
  );
  tokenWorker = createWorker(
    QUEUE_NAMES.TOKEN_GENERATION,
    processTokenGeneration,
    5,
  );
  smsWorker = createWorker(QUEUE_NAMES.SMS_DELIVERY, processSmsDelivery, 10);

  paymentWorker.on("completed", (job) => {
    console.log(`[Payment Worker] Completed: ${job.id}`);
  });
  paymentWorker.on("failed", (job, error) => {
    console.error(`[Payment Worker] Failed: ${job?.id}`, error.message);
  });

  appNotificationWorker.on("completed", (job) => {
    console.log(`[App Notification Worker] Completed: ${job.id}`);
  });
  appNotificationWorker.on("failed", (job, error) => {
    console.error(
      `[App Notification Worker] Failed: ${job?.id}`,
      error.message,
    );
  });

  tokenWorker.on("completed", (job) => {
    console.log(`[Token Worker] Completed: ${job.id}`);
  });
  tokenWorker.on("failed", (job, error) => {
    console.error(`[Token Worker] Failed: ${job?.id}`, error.message);
  });

  smsWorker.on("completed", (job) => {
    console.log(`[SMS Worker] Completed: ${job.id}`);
  });
  smsWorker.on("failed", (job, error) => {
    console.error(`[SMS Worker] Failed: ${job?.id}`, error.message);
  });

  await Promise.all([
    paymentWorker.waitUntilReady(),
    appNotificationWorker.waitUntilReady(),
    tokenWorker.waitUntilReady(),
    smsWorker.waitUntilReady(),
  ]);
}

// ============================================================
// Graceful Shutdown
// ============================================================

export async function closeAllQueues(): Promise<void> {
  console.log("[Queues] Shutting down...");

  await Promise.all([
    paymentWorker?.close(),
    appNotificationWorker?.close(),
    tokenWorker?.close(),
    smsWorker?.close(),
    paymentProcessingQueue.close(),
    appNotificationDeliveryQueue.close(),
    tokenGenerationQueue.close(),
    smsDeliveryQueue.close(),
  ]);

  paymentWorker = null;
  appNotificationWorker = null;
  tokenWorker = null;
  smsWorker = null;

  console.log("[Queues] All queues closed");
}

// ============================================================
// Queue Health Check
// ============================================================

export async function getQueueHealth(): Promise<{
  appNotifications: { waiting: number; active: number; failed: number };
  payment: { waiting: number; active: number; failed: number };
  token: { waiting: number; active: number; failed: number };
  sms: { waiting: number; active: number; failed: number };
}> {
  const [paymentCounts, appNotificationCounts, tokenCounts, smsCounts] =
    await Promise.all([
      paymentProcessingQueue.getJobCounts("waiting", "active", "failed"),
      appNotificationDeliveryQueue.getJobCounts("waiting", "active", "failed"),
      tokenGenerationQueue.getJobCounts("waiting", "active", "failed"),
      smsDeliveryQueue.getJobCounts("waiting", "active", "failed"),
    ]);

  return {
    appNotifications: {
      waiting: appNotificationCounts.waiting,
      active: appNotificationCounts.active,
      failed: appNotificationCounts.failed,
    },
    payment: {
      waiting: paymentCounts.waiting,
      active: paymentCounts.active,
      failed: paymentCounts.failed,
    },
    token: {
      waiting: tokenCounts.waiting,
      active: tokenCounts.active,
      failed: tokenCounts.failed,
    },
    sms: {
      waiting: smsCounts.waiting,
      active: smsCounts.active,
      failed: smsCounts.failed,
    },
  };
}

// ============================================================
// Re-exports
// ============================================================

export { QUEUE_NAMES, redisConnection } from "./connection";
export type * from "./types";
