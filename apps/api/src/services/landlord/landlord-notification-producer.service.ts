import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  customerAppNotifications,
  meters,
  motherMeters,
} from "../../db/schema";
import type { LandlordAppNotificationType } from "../../lib/customer-app-notification-types";
import {
  formatLandlordDailyUsageAppNotification,
  formatLandlordMotherMeterEventAppNotification,
  formatLandlordPrepaidLowBalanceAppNotification,
  formatLandlordSubMeterPurchaseAppNotification,
} from "../../lib/landlord-app-notification-formatters";
import { enqueueCustomerAppNotificationDelivery } from "../customer/app-notifications.service";
import type { LandlordDailyUsageSummary } from "./landlord-daily-usage-summary.types";
import type {
  MotherMeterLowBalanceAlert,
} from "../mother-meter-analytics.service";

export async function queueDailyLandlordUsageSummaryAppNotifications(input: {
  summaries: LandlordDailyUsageSummary[];
  targetDate: string;
}) {
  let created = 0;
  let skippedDuplicate = 0;

  for (const summary of input.summaries) {
    const referenceId = `landlord-daily-usage:${summary.landlordId}:${input.targetDate}`;
    const content = formatLandlordDailyUsageAppNotification({
      summary,
      targetDate: input.targetDate,
    });
    const result = await createLandlordNotificationIfMissing({
      landlordId: summary.landlordId,
      message: content.message,
      metadata: {
        amountTotal: summary.amountTotal.toFixed(2),
        landlordId: summary.landlordId,
        targetDate: input.targetDate,
        transactionCount: String(summary.transactionCount),
        unitsTotal: summary.unitsTotal.toFixed(4),
      },
      meterNumber: Array.from(summary.motherMeterBuckets.values())
        .map((bucket) => bucket.motherMeterNumber)
        .sort((left, right) => left.localeCompare(right))
        .join(", "),
      phoneNumber: summary.phoneNumber,
      referenceId,
      title: content.title,
      type: "landlord_daily_usage_summary",
    });
    created += result.created;
    skippedDuplicate += result.skippedDuplicate;
  }

  return { created, skippedDuplicate };
}

export async function queueLandlordSubMeterPurchaseNotification(input: {
  amountPaid: string;
  meterId: string;
  meterNumber: string;
  referenceId: string;
  unitsPurchased: string;
}) {
  const match = ensureExists(
    await db.query.meters.findFirst({
      where: eq(meters.id, input.meterId),
      columns: {},
      with: {
        motherMeter: {
          columns: {
            id: true,
            landlordId: true,
            motherMeterNumber: true,
            propertyId: true,
          },
          with: {
            landlord: {
              columns: {
                phoneNumber: true,
              },
            },
          },
        },
      },
    }),
    `Meter ${input.meterId} not found for landlord notification`,
  );
  const content = formatLandlordSubMeterPurchaseAppNotification({
    amountPaid: input.amountPaid,
    meterNumber: input.meterNumber,
    motherMeterNumber: match.motherMeter.motherMeterNumber,
    unitsPurchased: input.unitsPurchased,
  });

  return createLandlordNotificationIfMissing({
    landlordId: match.motherMeter.landlordId,
    message: content.message,
    metadata: {
      amountPaid: input.amountPaid,
      meterId: input.meterId,
      motherMeterId: match.motherMeter.id,
      motherMeterNumber: match.motherMeter.motherMeterNumber,
      propertyId: match.motherMeter.propertyId,
      unitsPurchased: input.unitsPurchased,
    },
    meterNumber: input.meterNumber,
    phoneNumber: match.motherMeter.landlord.phoneNumber,
    referenceId: input.referenceId,
    title: content.title,
    type: "landlord_sub_meter_purchase",
  });
}

export async function queueLandlordLowBalanceAppNotification(
  alert: MotherMeterLowBalanceAlert,
) {
  const referenceDate = new Date().toISOString().slice(0, 10);
  const content = formatLandlordPrepaidLowBalanceAppNotification({
    estimatedBalance: alert.estimatedBalance,
    lowBalanceThreshold: alert.lowBalanceThreshold,
    motherMeterNumber: alert.motherMeterNumber,
  });

  return createLandlordNotificationIfMissing({
    landlordId: alert.landlordId,
    message: content.message,
    metadata: {
      estimatedBalance: alert.estimatedBalance.toFixed(2),
      lowBalanceThreshold: alert.lowBalanceThreshold.toFixed(2),
      motherMeterId: alert.motherMeterId,
      motherMeterNumber: alert.motherMeterNumber,
      propertyId: alert.propertyId,
    },
    meterNumber: alert.motherMeterNumber,
    phoneNumber: alert.landlordPhoneNumber,
    referenceId: `landlord-low-balance:${alert.motherMeterId}:${referenceDate}`,
    title: content.title,
    type: "landlord_prepaid_low_balance",
  });
}

export async function queueLandlordMotherMeterEventAppNotification(input: {
  amount: string;
  eventType: "bill_payment" | "initial_deposit" | "refill";
  motherMeterId: string;
  referenceId: string;
}) {
  const motherMeter = await db.query.motherMeters.findFirst({
    where: eq(motherMeters.id, input.motherMeterId),
    columns: {
      id: true,
      landlordId: true,
      motherMeterNumber: true,
      propertyId: true,
    },
    with: {
      landlord: {
        columns: {
          phoneNumber: true,
        },
      },
    },
  });
  if (motherMeter === undefined) {
    return { created: 0, skippedDuplicate: 0 };
  }

  const content = formatLandlordMotherMeterEventAppNotification({
    amount: input.amount,
    eventType: input.eventType,
    motherMeterNumber: motherMeter.motherMeterNumber,
  });

  return createLandlordNotificationIfMissing({
    landlordId: motherMeter.landlordId,
    message: content.message,
    metadata: {
      amount: input.amount,
      eventType: input.eventType,
      motherMeterId: motherMeter.id,
      motherMeterNumber: motherMeter.motherMeterNumber,
      propertyId: motherMeter.propertyId,
    },
    meterNumber: motherMeter.motherMeterNumber,
    phoneNumber: motherMeter.landlord.phoneNumber,
    referenceId: input.referenceId,
    title: content.title,
    type: "landlord_mother_meter_event_recorded",
  });
}

async function createLandlordNotificationIfMissing(input: {
  landlordId: string;
  message: string;
  metadata: Record<string, string | null>;
  meterNumber: string;
  phoneNumber?: string;
  referenceId: string;
  title: string;
  type: LandlordAppNotificationType;
}) {
  const existing = await db.query.customerAppNotifications.findFirst({
    where: and(
      eq(customerAppNotifications.landlordId, input.landlordId),
      eq(customerAppNotifications.referenceId, input.referenceId),
      eq(customerAppNotifications.type, input.type),
    ),
    columns: { id: true },
  });
  if (existing) {
    return { created: 0, skippedDuplicate: 1 };
  }

  const [notification] = await db
    .insert(customerAppNotifications)
    .values({
      landlordId: input.landlordId,
      message: input.message,
      metadata: input.metadata,
      meterNumber: input.meterNumber,
      phoneNumber: input.phoneNumber ?? null,
      referenceId: input.referenceId,
      title: input.title,
      type: input.type,
    })
    .returning({ id: customerAppNotifications.id });

  await enqueueCustomerAppNotificationDelivery(notification.id);
  return { created: 1, skippedDuplicate: 0 };
}

function ensureExists<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

