import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  meters,
  motherMeterEvents,
  motherMeters,
  transactions,
} from "../db/schema";
import {
  loadLatestBillPaymentDates,
  loadMotherMeterBalanceTotals,
} from "./mother-meter-analytics-bulk.service";

interface ReconciliationOptions {
  motherMeterId: string;
  startDate?: Date | null;
  endDate?: Date | null;
}

interface LowBalanceAlertOptions {
  landlordId?: string;
  limit?: number;
  offset?: number;
  includeAboveThreshold?: boolean;
  propertyId?: string;
}

interface PostpaidReminderOptions {
  landlordId?: string;
  limit?: number;
  offset?: number;
  daysAfterLastPayment?: number;
  includeNotDue?: boolean;
  propertyId?: string;
}

export interface MotherMeterLowBalanceAlert {
  motherMeterId: string;
  motherMeterNumber: string;
  propertyId: string;
  type: "prepaid" | "postpaid";
  landlordId: string;
  landlordName: string;
  landlordPhoneNumber: string;
  estimatedBalance: number;
  lowBalanceThreshold: number;
  isBelowThreshold: boolean;
}

export interface PostpaidPaymentReminder {
  motherMeterId: string;
  motherMeterNumber: string;
  propertyId: string;
  landlordId: string;
  landlordName: string;
  landlordPhoneNumber: string;
  lastBillPaymentAt: Date | null;
  reminderDate: Date | null;
  daysSinceLastPayment: number | null;
  isReminderDue: boolean;
}

export async function computeMotherMeterBalance(motherMeterId: string) {
  const totals = (await loadMotherMeterBalanceTotals([motherMeterId])).get(
    motherMeterId,
  );
  const deposits = totals?.deposits ?? 0;
  const billPayments = totals?.billPayments ?? 0;
  const netSales = totals?.netSales ?? 0;
  const estimatedBalance = deposits - billPayments - netSales;

  return {
    deposits,
    billPayments,
    netSales,
    estimatedBalance,
  };
}

export async function computeMotherMeterReconciliation(
  options: ReconciliationOptions
) {
  const txConditions = [
    eq(meters.motherMeterId, options.motherMeterId),
    eq(transactions.status, "completed"),
  ];
  if (options.startDate) {
    txConditions.push(gte(transactions.createdAt, options.startDate));
  }
  if (options.endDate) {
    txConditions.push(lte(transactions.createdAt, options.endDate));
  }

  const [sales] = await db
    .select({
      total: sql<string>`coalesce(sum(${transactions.netAmount}::numeric), 0)`,
    })
    .from(transactions)
    .innerJoin(meters, eq(transactions.meterId, meters.id))
    .where(and(...txConditions));

  const eventConditions = [
    eq(motherMeterEvents.motherMeterId, options.motherMeterId),
    eq(motherMeterEvents.eventType, "bill_payment"),
  ];
  if (options.startDate) {
    eventConditions.push(gte(motherMeterEvents.createdAt, options.startDate));
  }
  if (options.endDate) {
    eventConditions.push(lte(motherMeterEvents.createdAt, options.endDate));
  }

  const [billPayments] = await db
    .select({
      total: sql<string>`coalesce(sum(${motherMeterEvents.amount}::numeric), 0)`,
    })
    .from(motherMeterEvents)
    .where(and(...eventConditions));

  const netSalesCollected = toNumber(sales.total);
  const kplcPayments = toNumber(billPayments.total);

  return {
    netSalesCollected,
    kplcPayments,
    variance: netSalesCollected - kplcPayments,
  };
}

export async function listMotherMeterLowBalanceAlerts(
  options: LowBalanceAlertOptions = {}
): Promise<MotherMeterLowBalanceAlert[]> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const includeAboveThreshold = options.includeAboveThreshold ?? false;

  const filters = [];
  if (options.landlordId) {
    filters.push(eq(motherMeters.landlordId, options.landlordId));
  }
  if (options.propertyId) {
    filters.push(eq(motherMeters.propertyId, options.propertyId));
  }

  const allMeters = await db.query.motherMeters.findMany({
    limit,
    offset,
    where: filters.length > 0 ? and(...filters) : undefined,
    columns: {
      id: true,
      motherMeterNumber: true,
      propertyId: true,
      type: true,
      lowBalanceThreshold: true,
      landlordId: true,
    },
    with: {
      landlord: {
        columns: {
          id: true,
          name: true,
          phoneNumber: true,
        },
      },
    },
  });

  const balanceTotals = await loadMotherMeterBalanceTotals(
    allMeters.map((meter) => meter.id),
  );

  const alerts = allMeters.map((meter) => {
    const totals = balanceTotals.get(meter.id);
    const estimatedBalance =
      (totals?.deposits ?? 0) - (totals?.billPayments ?? 0) - (totals?.netSales ?? 0);
    const lowBalanceThreshold = toNumber(meter.lowBalanceThreshold);

    return {
      motherMeterId: meter.id,
      motherMeterNumber: meter.motherMeterNumber,
      propertyId: meter.propertyId,
      type: meter.type,
      landlordId: meter.landlordId,
      landlordName: meter.landlord.name,
      landlordPhoneNumber: meter.landlord.phoneNumber,
      estimatedBalance,
      lowBalanceThreshold,
      isBelowThreshold: estimatedBalance < lowBalanceThreshold,
    };
  });

  if (includeAboveThreshold) {
    return alerts;
  }
  return alerts.filter((alert) => alert.isBelowThreshold);
}

export async function listPostpaidPaymentReminders(
  options: PostpaidReminderOptions = {}
): Promise<PostpaidPaymentReminder[]> {
  const now = new Date();
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const daysAfterLastPayment = options.daysAfterLastPayment ?? 13;
  const includeNotDue = options.includeNotDue ?? false;

  const filters = [eq(motherMeters.type, "postpaid")];
  if (options.landlordId) {
    filters.push(eq(motherMeters.landlordId, options.landlordId));
  }
  if (options.propertyId) {
    filters.push(eq(motherMeters.propertyId, options.propertyId));
  }

  const postpaidMeters = await db.query.motherMeters.findMany({
    where: and(...filters),
    limit,
    offset,
    columns: {
      id: true,
      motherMeterNumber: true,
      propertyId: true,
      landlordId: true,
    },
    with: {
      landlord: {
        columns: {
          id: true,
          name: true,
          phoneNumber: true,
        },
      },
    },
  });

  const latestBillPaymentDates = await loadLatestBillPaymentDates(
    postpaidMeters.map((meter) => meter.id),
  );

  const reminders = postpaidMeters.map((meter) => {
    const lastBillPaymentAt = latestBillPaymentDates.get(meter.id) ?? null;
    const reminderDate = lastBillPaymentAt
      ? addDays(lastBillPaymentAt, daysAfterLastPayment)
      : null;
    const daysSinceLastPayment = lastBillPaymentAt
      ? Math.floor((now.getTime() - lastBillPaymentAt.getTime()) / 86_400_000)
      : null;
    const isReminderDue = reminderDate != null && now >= reminderDate;

    return {
      motherMeterId: meter.id,
      motherMeterNumber: meter.motherMeterNumber,
      propertyId: meter.propertyId,
      landlordId: meter.landlordId,
      landlordName: meter.landlord.name,
      landlordPhoneNumber: meter.landlord.phoneNumber,
      lastBillPaymentAt,
      reminderDate,
      daysSinceLastPayment,
      isReminderDue,
    };
  });

  if (includeNotDue) {
    return reminders;
  }
  return reminders.filter((item) => item.isReminderDue);
}

function toNumber(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
