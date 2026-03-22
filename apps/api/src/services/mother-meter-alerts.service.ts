import {
  createAdminNotification,
  hasRecentAdminNotification,
} from "./admin/admin-notifications.service";
import {
  queueLandlordLowBalanceAppNotification,
} from "./landlord/landlord-notification-producer.service";
import {
  listMotherMeterLowBalanceAlerts,
  listPostpaidPaymentReminders,
} from "./mother-meter-analytics.service";

export { queueDailyLandlordUsageSummarySms } from "./daily-usage-sms.service";

interface QueueNotificationOptions {
  maxAlerts?: number;
}

interface QueueLowBalanceOptions extends QueueNotificationOptions {
  dedupeWindowHours?: number;
}

interface QueuePostpaidReminderOptions extends QueueNotificationOptions {
  dedupeWindowHours?: number;
  daysAfterLastPayment?: number;
}

export interface QueueNotificationResult {
  appNotificationsCreated: number;
  appNotificationsSkippedDuplicate: number;
  totalEligible: number;
  queued: number;
  skippedDuplicate: number;
  failed: number;
}

export async function queueLowBalanceNotifications(
  options: QueueLowBalanceOptions = {},
): Promise<QueueNotificationResult> {
  const dedupeWindowHours = options.dedupeWindowHours ?? 12;
  const alerts = await listMotherMeterLowBalanceAlerts();
  const selectedAlerts = limitItems(alerts, options.maxAlerts);

  let queued = 0;
  let skippedDuplicate = 0;
  let failed = 0;
  let appNotificationsCreated = 0;
  let appNotificationsSkippedDuplicate = 0;

  for (const alert of selectedAlerts) {
    const isDuplicate = await hasRecentAdminNotification({
      type: "mother_meter_low_balance",
      entityId: alert.motherMeterId,
      dedupeWindowHours,
    });
    if (isDuplicate) {
      skippedDuplicate += 1;
      continue;
    }

    try {
      await createAdminNotification({
        type: "mother_meter_low_balance",
        severity: alert.estimatedBalance < 0 ? "critical" : "warning",
        title: `Mother meter ${alert.motherMeterNumber} below threshold`,
        message: `Estimated balance KES ${alert.estimatedBalance.toFixed(
          2,
        )} is below threshold KES ${alert.lowBalanceThreshold.toFixed(2)}.`,
        entityType: "mother_meter",
        entityId: alert.motherMeterId,
        metadata: {
          landlordId: alert.landlordId,
          landlordName: alert.landlordName,
          landlordPhoneNumber: alert.landlordPhoneNumber,
          estimatedBalance: alert.estimatedBalance,
          lowBalanceThreshold: alert.lowBalanceThreshold,
        },
      });
      queued += 1;

      if (alert.type === "prepaid") {
        const appResult = await queueLandlordLowBalanceAppNotification(alert);
        appNotificationsCreated += appResult.created;
        appNotificationsSkippedDuplicate += appResult.skippedDuplicate;
      }
    } catch (error) {
      failed += 1;
      console.error(
        `[Mother Meter Alerts] Failed low-balance queue for ${alert.motherMeterNumber}:`,
        error,
      );
    }
  }

  return {
    appNotificationsCreated,
    appNotificationsSkippedDuplicate,
    totalEligible: alerts.length,
    queued,
    skippedDuplicate,
    failed,
  };
}

export async function queuePostpaidReminderNotifications(
  options: QueuePostpaidReminderOptions = {},
): Promise<QueueNotificationResult> {
  const dedupeWindowHours = options.dedupeWindowHours ?? 24;
  const reminders = await listPostpaidPaymentReminders({
    daysAfterLastPayment: options.daysAfterLastPayment,
  });
  const selectedReminders = limitItems(reminders, options.maxAlerts);

  let queued = 0;
  let skippedDuplicate = 0;
  let failed = 0;
  const appNotificationsCreated = 0;
  const appNotificationsSkippedDuplicate = 0;

  for (const reminder of selectedReminders) {
    if (!reminder.lastBillPaymentAt || !reminder.reminderDate) {
      continue;
    }

    const isDuplicate = await hasRecentAdminNotification({
      type: "postpaid_payment_reminder",
      entityId: reminder.motherMeterId,
      dedupeWindowHours,
    });
    if (isDuplicate) {
      skippedDuplicate += 1;
      continue;
    }

    try {
      await createAdminNotification({
        type: "postpaid_payment_reminder",
        severity: "warning",
        title: `Postpaid reminder due for ${reminder.motherMeterNumber}`,
        message: `Last bill payment was on ${reminder.lastBillPaymentAt
          .toISOString()
          .slice(0, 10)}. Reminder date reached on ${reminder.reminderDate
          .toISOString()
          .slice(0, 10)}.`,
        entityType: "mother_meter",
        entityId: reminder.motherMeterId,
        metadata: {
          landlordId: reminder.landlordId,
          landlordName: reminder.landlordName,
          landlordPhoneNumber: reminder.landlordPhoneNumber,
          daysSinceLastPayment: reminder.daysSinceLastPayment,
        },
      });
      queued += 1;

    } catch (error) {
      failed += 1;
      console.error(
        `[Mother Meter Alerts] Failed postpaid reminder queue for ${reminder.motherMeterNumber}:`,
        error,
      );
    }
  }

  return {
    appNotificationsCreated,
    appNotificationsSkippedDuplicate,
    totalEligible: reminders.length,
    queued,
    skippedDuplicate,
    failed,
  };
}

function limitItems<T>(items: T[], maxItems?: number): T[] {
  if (!maxItems || maxItems < 1) {
    return items;
  }
  return items.slice(0, maxItems);
}


