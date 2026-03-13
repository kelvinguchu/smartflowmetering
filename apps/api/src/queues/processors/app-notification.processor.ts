import type { Job } from "bullmq";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { customerDeviceTokens } from "../../db/schema";
import {
  isPermanentTokenFailure,
  sendMulticastNotification,
} from "../../lib/firebase-messaging";
import {
  getCustomerAppNotificationById,
  markCustomerAppNotificationFailed,
  markCustomerAppNotificationSent,
  recordCustomerAppNotificationAttempt,
  recordCustomerAppNotificationRetryableFailure,
} from "../../services/app-notification-state.service";
import type { AppNotificationDeliveryJob } from "../types";

export async function processAppNotificationDelivery(
  job: Job<AppNotificationDeliveryJob>,
): Promise<{ deliveredTokens: number; notificationId: string }> {
  const notificationId = job.data.customerAppNotificationId;
  const notification = await getCustomerAppNotificationById(notificationId);
  if (!notification) {
    throw new Error(`Customer app notification ${notificationId} not found`);
  }
  await recordCustomerAppNotificationAttempt(notificationId);

  const devices = await db.query.customerDeviceTokens.findMany({
    where: and(
      eq(customerDeviceTokens.phoneNumber, notification.phoneNumber),
      eq(customerDeviceTokens.status, "active"),
    ),
  });
  if (devices.length === 0) {
    await markCustomerAppNotificationFailed(notificationId, {
      code: "fcm/no-active-device-tokens",
      message: "No active device tokens were found for this phone number",
    });
    return { deliveredTokens: 0, notificationId };
  }

  let response;
  try {
    response = await sendMulticastNotification({
      data: {
        meterNumber: notification.meterNumber,
        notificationId: notification.id,
        promptType: notification.type,
        referenceId: notification.referenceId,
      },
      message: notification.message,
      title: notification.title,
      tokens: devices.map((device) => device.token),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string" && error.length > 0
          ? error
          : "Unknown FCM delivery error";
    await handleRetryableFailure(job, notificationId, {
      code: "fcm/send-exception",
      message: errorMessage,
    });
    throw error;
  }

  const invalidTokens = response.responses
    .flatMap((result, index) =>
      !result.success &&
      isPermanentTokenFailure(result.error?.code)
        ? [devices[index].token]
        : [],
    );

  if (invalidTokens.length > 0) {
    await db
      .update(customerDeviceTokens)
      .set({
        invalidatedAt: new Date(),
        invalidationReason: "fcm_invalid_token",
        status: "inactive",
        updatedAt: new Date(),
      })
      .where(inArray(customerDeviceTokens.token, invalidTokens));
  }

  if (response.successCount > 0) {
    await markCustomerAppNotificationSent(notificationId);
    return { deliveredTokens: response.successCount, notificationId };
  }

  const transientFailure = response.responses.find(
    (result) =>
      !result.success && !isPermanentTokenFailure(result.error?.code),
  );
  const hasTransientFailure = transientFailure !== undefined;
  if (hasTransientFailure) {
    const errorCode = transientFailure.error?.code ?? "fcm/retryable-error";
    const errorMessage =
      transientFailure.error?.message ?? "FCM delivery failed with retryable errors";

    await handleRetryableFailure(job, notificationId, {
      code: errorCode,
      message: errorMessage,
    });
    throw new Error(errorMessage);
  }

  await markCustomerAppNotificationFailed(notificationId, {
    code: "fcm/permanent-failure",
    message: "FCM permanently rejected all active device tokens",
  });
  return { deliveredTokens: 0, notificationId };
}

async function handleRetryableFailure(
  job: Job<AppNotificationDeliveryJob>,
  notificationId: string,
  input: { code: string; message: string },
): Promise<void> {
  const maxAttempts =
    typeof job.opts.attempts === "number" && job.opts.attempts > 0
      ? job.opts.attempts
      : 1;
  const currentAttempt = job.attemptsMade + 1;

  if (currentAttempt >= maxAttempts) {
    await markCustomerAppNotificationFailed(notificationId, input);
    return;
  }

  await recordCustomerAppNotificationRetryableFailure(notificationId, input);
}
