import { and, eq, gte, lte, sql } from "drizzle-orm";
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
  getDateBoundsInTimezone,
  getPreviousDateInTimezone,
} from "../lib/timezone-dates";

interface DailyUsageSmsOptions {
  targetDate?: string;
  timezone?: string;
  maxLandlords?: number;
}

const DAILY_USAGE_SMS_HEADER = "Smart Flow Metering Daily Purchase Summary";

export async function queueDailyLandlordUsageSummarySms(
  options: DailyUsageSmsOptions = {},
) {
  const timezone = options.timezone ?? "Africa/Nairobi";
  const targetDate = options.targetDate ?? getPreviousDateInTimezone(timezone);

  const { dayStart, dayEnd } = getDateBoundsInTimezone(targetDate, timezone);

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
    .where(
      and(
        eq(transactions.status, "completed"),
        gte(transactions.completedAt, dayStart),
        lte(transactions.completedAt, dayEnd),
      ),
    );

  const grouped = groupTransactionsByLandlord(rows);
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

    const messageBody = buildDailyUsageMessageBody(landlord, targetDate);

    try {
      await smsDeliveryQueue.add(
        "send-notification-sms",
        {
          kind: "notification" as const,
          phoneNumber: landlord.phoneNumber,
          messageBody,
        },
        {
          jobId: `sms-daily-usage-${landlord.landlordId}-${targetDate.replaceAll(
            "-",
            "",
          )}`,
        },
      );
      queued += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `[Daily Usage SMS] Failed to queue for landlord ${landlord.landlordId}:`,
        error,
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

interface LandlordBucket {
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

function groupTransactionsByLandlord(
  rows: {
    landlordId: string;
    landlordName: string;
    phoneNumber: string;
    motherMeterId: string;
    motherMeterNumber: string;
    subMeterNumber: string;
    amountPaid: string;
    unitsPurchased: string;
  }[],
): Map<string, LandlordBucket> {
  const grouped = new Map<string, LandlordBucket>();

  for (const row of rows) {
    const key = row.landlordId;
    const current = grouped.get(key) ?? {
      landlordId: row.landlordId,
      landlordName: row.landlordName,
      phoneNumber: row.phoneNumber,
      transactionCount: 0,
      amountTotal: 0,
      unitsTotal: 0,
      motherMeterBuckets: new Map(),
    };

    const motherMeterBucket = current.motherMeterBuckets.get(
      row.motherMeterId,
    ) ?? {
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

  return grouped;
}

function buildDailyUsageMessageBody(
  landlord: LandlordBucket,
  targetDate: string,
): string {
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
          4,
        )} kWh | Amount: KES ${bucket.amountTotal.toFixed(2)}`
      );
    })
    .join("\n\n");

  return (
    `${DAILY_USAGE_SMS_HEADER} (${targetDate})\n` +
    `Mother meters with purchases: ${landlord.motherMeterBuckets.size}\n\n` +
    `${motherMeterSections}\n\n` +
    `Total Txns: ${landlord.transactionCount}\n` +
    `Total Units: ${landlord.unitsTotal.toFixed(4)} kWh\n` +
    `Total Amount: KES ${landlord.amountTotal.toFixed(2)}`
  );
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
        sql`${smsLogs.messageBody} like ${searchPattern}`,
      ),
    )
    .limit(1);

  return Boolean(existing);
}
