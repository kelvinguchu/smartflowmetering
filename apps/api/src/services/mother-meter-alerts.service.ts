import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  customers,
  meters,
  motherMeters,
  smsLogs,
  transactions,
} from "../db/schema";
import { smsDeliveryQueue } from "../queues";
import {
  listMotherMeterLowBalanceAlerts,
  listPostpaidPaymentReminders,
} from "./mother-meter-analytics.service";
import { createAdminNotification, hasRecentAdminNotification } from "./admin-notifications.service";

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

interface DailyUsageSmsOptions {
  targetDate?: string;
  timezone?: string;
  maxLandlords?: number;
}

export interface QueueNotificationResult {
  totalEligible: number;
  queued: number;
  skippedDuplicate: number;
  failed: number;
}

const DAILY_USAGE_SMS_HEADER = "Smart Flow Metering Daily Purchase Summary";

export async function queueLowBalanceNotifications(
  options: QueueLowBalanceOptions = {}
): Promise<QueueNotificationResult> {
  const dedupeWindowHours = options.dedupeWindowHours ?? 12;
  const alerts = await listMotherMeterLowBalanceAlerts();
  const selectedAlerts = limitItems(alerts, options.maxAlerts);

  let queued = 0;
  let skippedDuplicate = 0;
  let failed = 0;

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
          2
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
    } catch (error) {
      failed += 1;
      console.error(
        `[Mother Meter Alerts] Failed low-balance queue for ${alert.motherMeterNumber}:`,
        error
      );
    }
  }

  return {
    totalEligible: alerts.length,
    queued,
    skippedDuplicate,
    failed,
  };
}

export async function queuePostpaidReminderNotifications(
  options: QueuePostpaidReminderOptions = {}
): Promise<QueueNotificationResult> {
  const dedupeWindowHours = options.dedupeWindowHours ?? 24;
  const reminders = await listPostpaidPaymentReminders({
    daysAfterLastPayment: options.daysAfterLastPayment,
  });
  const selectedReminders = limitItems(reminders, options.maxAlerts);

  let queued = 0;
  let skippedDuplicate = 0;
  let failed = 0;

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
        error
      );
    }
  }

  return {
    totalEligible: reminders.length,
    queued,
    skippedDuplicate,
    failed,
  };
}

export async function queueDailyLandlordUsageSummarySms(
  options: DailyUsageSmsOptions = {}
) {
  const timezone = options.timezone ?? "Africa/Nairobi";
  const targetDate = options.targetDate ?? getPreviousDateInTimezone(timezone);

  const rows = await db
    .select({
      landlordId: customers.id,
      landlordName: customers.name,
      phoneNumber: customers.phoneNumber,
      motherMeterId: motherMeters.id,
      motherMeterNumber: motherMeters.motherMeterNumber,
      subMeterNumber: meters.meterNumber,
      amountPaid: transactions.amountPaid,
      unitsPurchased: transactions.unitsPurchased,
      completedAt: transactions.completedAt,
    })
    .from(transactions)
    .innerJoin(meters, eq(transactions.meterId, meters.id))
    .innerJoin(motherMeters, eq(meters.motherMeterId, motherMeters.id))
    .innerJoin(customers, eq(motherMeters.landlordId, customers.id))
    .where(eq(transactions.status, "completed"));

  const filtered = rows.filter((row) => {
    const completedAt = row.completedAt ?? new Date();
    return formatDateInTimezone(completedAt, timezone) === targetDate;
  });

  const grouped = new Map<
    string,
    {
      landlordId: string;
      landlordName: string;
      phoneNumber: string;
      transactionCount: number;
      amountTotal: number;
      unitsTotal: number;
      motherMeterBuckets: Map<
        string,
        {
          motherMeterId: string;
          motherMeterNumber: string;
          transactionCount: number;
          amountTotal: number;
          unitsTotal: number;
          subMeters: Set<string>;
        }
      >;
    }
  >();

  for (const row of filtered) {
    const key = row.landlordId;
    const current =
      grouped.get(key) ?? {
        landlordId: row.landlordId,
        landlordName: row.landlordName,
        phoneNumber: row.phoneNumber,
        transactionCount: 0,
        amountTotal: 0,
        unitsTotal: 0,
        motherMeterBuckets: new Map(),
      };

    const motherMeterBucket =
      current.motherMeterBuckets.get(row.motherMeterId) ?? {
        motherMeterId: row.motherMeterId,
        motherMeterNumber: row.motherMeterNumber,
        transactionCount: 0,
        amountTotal: 0,
        unitsTotal: 0,
        subMeters: new Set<string>(),
      };

    current.transactionCount += 1;
    current.amountTotal += Number.parseFloat(row.amountPaid);
    current.unitsTotal += Number.parseFloat(row.unitsPurchased);
    motherMeterBucket.transactionCount += 1;
    motherMeterBucket.amountTotal += Number.parseFloat(row.amountPaid);
    motherMeterBucket.unitsTotal += Number.parseFloat(row.unitsPurchased);
    motherMeterBucket.subMeters.add(row.subMeterNumber);
    current.motherMeterBuckets.set(row.motherMeterId, motherMeterBucket);
    grouped.set(key, current);
  }

  const landlords = Array.from(grouped.values());
  const selected = limitItems(landlords, options.maxLandlords);

  let queued = 0;
  let skippedDuplicate = 0;
  let failed = 0;

  for (const landlord of selected) {
    const alreadySent = await hasDailySummarySms({
      phoneNumber: landlord.phoneNumber,
      targetDate,
    });
    if (alreadySent) {
      skippedDuplicate += 1;
      continue;
    }

    const motherMeterSections = Array.from(landlord.motherMeterBuckets.values())
      .sort((a, b) => a.motherMeterNumber.localeCompare(b.motherMeterNumber))
      .map((bucket) => {
        const subMeters = Array.from(bucket.subMeters)
          .sort((a, b) => a.localeCompare(b))
          .join(", ");

        return (
          `MM ${bucket.motherMeterNumber}\n` +
          `Submeters: ${subMeters}\n` +
          `Txns: ${bucket.transactionCount} | Units: ${bucket.unitsTotal.toFixed(
            4
          )} kWh | Amount: KES ${bucket.amountTotal.toFixed(2)}`
        );
      })
      .join("\n\n");

    const messageBody =
      `${DAILY_USAGE_SMS_HEADER} (${targetDate})\n` +
      `Mother meters with purchases: ${landlord.motherMeterBuckets.size}\n\n` +
      `${motherMeterSections}\n\n` +
      `Total Txns: ${landlord.transactionCount}\n` +
      `Total Units: ${landlord.unitsTotal.toFixed(4)} kWh\n` +
      `Total Amount: KES ${landlord.amountTotal.toFixed(2)}`;

    try {
      await smsDeliveryQueue.add(
        "send-notification-sms",
        {
          phoneNumber: landlord.phoneNumber,
          messageBody,
        },
        {
          jobId: `sms-daily-usage-${landlord.landlordId}-${targetDate.replaceAll(
            "-",
            ""
          )}`,
        }
      );
      queued += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `[Daily Usage SMS] Failed to queue for landlord ${landlord.landlordId}:`,
        error
      );
    }
  }

  return {
    targetDate,
    totalEligible: landlords.length,
    queued,
    skippedDuplicate,
    failed,
  };
}

function limitItems<T>(items: T[], maxItems?: number): T[] {
  if (!maxItems || maxItems < 1) return items;
  return items.slice(0, maxItems);
}

async function hasDailySummarySms(input: {
  phoneNumber: string;
  targetDate: string;
}) {
  const searchPattern = `%${DAILY_USAGE_SMS_HEADER} (${input.targetDate})%`;
  const [existing] = await db
    .select({ id: smsLogs.id })
    .from(smsLogs)
    .where(
      and(
        eq(smsLogs.phoneNumber, input.phoneNumber),
        gte(smsLogs.createdAt, new Date(Date.now() - 72 * 3_600_000)),
        sql`${smsLogs.messageBody} like ${searchPattern}`
      )
    )
    .limit(1);

  return Boolean(existing);
}

function formatDateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function getPreviousDateInTimezone(timezone: string): string {
  const yesterday = new Date(Date.now() - 86_400_000);
  return formatDateInTimezone(yesterday, timezone);
}
