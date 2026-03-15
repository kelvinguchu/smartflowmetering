import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { customerAppNotifications } from "../db/schema";
import { appNotificationDeliveryQueue } from "../queues";
import {
  getCustomerAppNotificationById,
  resetCustomerAppNotificationForRetry,
} from "./app-notification-state.service";

const APP_NOTIFICATION_ATTEMPTS = 5;
const APP_NOTIFICATION_BACKOFF_DELAY_MS = 5000;
const APP_NOTIFICATION_JOB_PREFIX = "customer-app-notification";

export async function listCustomerAppNotifications(input: {
  landlordId?: string;
  limit?: number;
  offset?: number;
  phoneNumber?: string;
  status?: "failed" | "pending" | "read" | "sent";
}) {
  const filters = [
    input.landlordId
      ? eq(customerAppNotifications.landlordId, input.landlordId)
      : undefined,
    input.phoneNumber
      ? eq(customerAppNotifications.phoneNumber, input.phoneNumber)
      : undefined,
    input.status ? eq(customerAppNotifications.status, input.status) : undefined,
  ].filter((value) => value !== undefined);

  return db.query.customerAppNotifications.findMany({
    where: filters.length > 1 ? and(...filters) : filters[0],
    orderBy: [desc(customerAppNotifications.createdAt)],
    limit: input.limit ?? 50,
    offset: input.offset ?? 0,
  });
}

export async function enqueueCustomerAppNotificationDelivery(
  customerAppNotificationId: string,
) {
  const notification = await getCustomerAppNotificationById(
    customerAppNotificationId,
  );
  if (!notification) {
    throw new Error("Customer app notification not found");
  }
  if (notification.status === "sent" || notification.status === "read") {
    throw new Error("Delivered app notifications cannot be requeued");
  }

  await resetCustomerAppNotificationForRetry(customerAppNotificationId);

  const jobId = `${APP_NOTIFICATION_JOB_PREFIX}-${customerAppNotificationId}`;
  const existingJob = await appNotificationDeliveryQueue.getJob(jobId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (
      state === "active" ||
      state === "waiting" ||
      state === "delayed" ||
      state === "prioritized"
    ) {
      return { id: customerAppNotificationId, jobId: String(existingJob.id) };
    }

    await existingJob.remove();
  }

  const job = await appNotificationDeliveryQueue.add(
    "deliver-app-notification",
    { customerAppNotificationId },
    {
      attempts: APP_NOTIFICATION_ATTEMPTS,
      backoff: {
        type: "exponential",
        delay: APP_NOTIFICATION_BACKOFF_DELAY_MS,
      },
      jobId,
    },
  );

  return { id: customerAppNotificationId, jobId: String(job.id) };
}
