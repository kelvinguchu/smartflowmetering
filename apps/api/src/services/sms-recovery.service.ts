import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { meters, smsLogs, transactions } from "../db/schema";
import { normalizeKenyanPhoneNumber } from "../lib/staff-contact";
import { redactTokensInText } from "../lib/token-redaction";
import { smsDeliveryQueue } from "../queues";
import type { SmsRecoveryListQuery } from "../validators/sms-recovery";
import { resolveSmsMessageBody } from "./sms-recovery-message.service";
import type {
  SmsRecoveryItem,
  SmsRecoveryListResult,
  SmsRecoverySummary,
} from "./sms-recovery.types";

export interface SmsRecoveryScopeTarget {
  id: string;
  meterNumber: string | null;
  phoneNumber: string | null;
  transactionId: string | null;
}

const PENDING_SMS_STATUSES = ["queued", "sent"] as const;

export async function listSmsRecoveryEntries(
  query: SmsRecoveryListQuery,
): Promise<SmsRecoveryListResult> {
  const criteria = normalizeCriteria(query);
  const meterId = await findMeterId(criteria.meterNumber);
  if (criteria.meterNumber && !meterId) {
    return emptyRecoveryList();
  }

  const transactionIds = await findTransactionIds(
    criteria.transactionId,
    meterId,
  );
  if ((criteria.transactionId || meterId) && transactionIds.length === 0) {
    return emptyRecoveryList();
  }

  const where = buildSmsRecoveryWhere(
    criteria.phoneNumber,
    transactionIds,
    criteria.deliveryState,
  );
  if (!where) {
    return emptyRecoveryList();
  }

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  const [rows, summary] = await Promise.all([
    db
      .select({
        smsLog: {
          createdAt: smsLogs.createdAt,
          id: smsLogs.id,
          messageBody: smsLogs.messageBody,
          phoneNumber: smsLogs.phoneNumber,
          provider: smsLogs.provider,
          providerErrorCode: smsLogs.providerErrorCode,
          providerStatus: smsLogs.providerStatus,
          status: smsLogs.status,
        },
        transaction: {
          transactionId: transactions.transactionId,
        },
        meter: {
          meterNumber: meters.meterNumber,
        },
      })
      .from(smsLogs)
      .leftJoin(transactions, eq(smsLogs.transactionId, transactions.id))
      .leftJoin(meters, eq(transactions.meterId, meters.id))
      .where(where)
      .orderBy(desc(smsLogs.createdAt))
      .limit(limit)
      .offset(offset),
    loadSmsRecoverySummary(where),
  ]);

  return {
    items: rows.map((row) => toSmsRecoveryItem(row)),
    summary,
  };
}

export async function queueSmsRetryById(
  smsLogId: string,
): Promise<{ jobId: string; smsLogId: string }> {
  const log = await db.query.smsLogs.findFirst({
    where: eq(smsLogs.id, smsLogId),
    columns: {
      id: true,
      messageBody: true,
      phoneNumber: true,
    },
  });
  if (!log) {
    throw new HTTPException(404, { message: "SMS log not found" });
  }

  const messageBody = await resolveSmsMessageBody(log.id, log.messageBody);
  const job = await smsDeliveryQueue.add(
    "sms-resend",
    {
      kind: "resend" as const,
      messageBody,
      phoneNumber: log.phoneNumber,
      smsLogId: log.id,
    },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    },
  );

  return {
    jobId: String(job.id),
    smsLogId: log.id,
  };
}

export async function getSmsRecoveryScopeTargetById(
  smsLogId: string,
): Promise<SmsRecoveryScopeTarget | null> {
  const [target] = await loadSmsRecoveryScopeTargets([smsLogId]);
  return target ?? null;
}

export async function listSmsRecoveryScopeTargetsByIds(
  smsLogIds: string[],
): Promise<SmsRecoveryScopeTarget[]> {
  return loadSmsRecoveryScopeTargets(smsLogIds);
}

function normalizeCriteria(query: SmsRecoveryListQuery) {
  const q = query.q?.trim();
  return {
    deliveryState: query.deliveryState,
    meterNumber: query.meterNumber?.trim() ?? q,
    phoneNumber: normalizePhoneNumber(query.phoneNumber ?? q),
    transactionId: query.transactionId?.trim() ?? q,
  };
}

function normalizePhoneNumber(
  phoneNumber: string | undefined,
): string | undefined {
  if (!phoneNumber) {
    return undefined;
  }

  try {
    return normalizeKenyanPhoneNumber(phoneNumber);
  } catch {
    return phoneNumber.trim();
  }
}

async function findMeterId(
  meterNumber: string | undefined,
): Promise<string | undefined> {
  if (!meterNumber) {
    return undefined;
  }

  const meter = await db.query.meters.findFirst({
    where: eq(meters.meterNumber, meterNumber),
    columns: { id: true },
  });

  return meter?.id;
}

async function findTransactionIds(
  transactionReference: string | undefined,
  meterId: string | undefined,
): Promise<string[]> {
  if (!transactionReference && !meterId) {
    return [];
  }

  const filters = [];
  if (transactionReference) {
    filters.push(eq(transactions.transactionId, transactionReference));
  }
  if (meterId) {
    filters.push(eq(transactions.meterId, meterId));
  }

  const rows = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(filters.length === 1 ? filters[0] : and(...filters))
    .limit(100);

  return rows.map((row) => row.id);
}

function buildSmsRecoveryWhere(
  phoneNumber: string | undefined,
  transactionIds: string[],
  deliveryState: SmsRecoveryListQuery["deliveryState"],
) {
  const filters = [];
  if (phoneNumber) {
    filters.push(eq(smsLogs.phoneNumber, phoneNumber));
  }
  if (transactionIds.length > 0) {
    filters.push(inArray(smsLogs.transactionId, transactionIds));
  }
  filters.push(buildDeliveryStateFilter(deliveryState));

  return filters.length === 1 ? filters[0] : and(...filters);
}

function buildDeliveryStateFilter(
  deliveryState: SmsRecoveryListQuery["deliveryState"],
) {
  switch (deliveryState) {
    case "delivered":
      return eq(smsLogs.status, "delivered");
    case "pending":
      return inArray(smsLogs.status, [...PENDING_SMS_STATUSES]);
    case "all":
      return (
        or(
          eq(smsLogs.status, "delivered"),
          eq(smsLogs.status, "failed"),
          inArray(smsLogs.status, [...PENDING_SMS_STATUSES]),
        ) ?? sql`true`
      );
    case "failed":
    default:
      return eq(smsLogs.status, "failed");
  }
}

async function loadSmsRecoverySummary(
  where: ReturnType<typeof buildSmsRecoveryWhere>,
): Promise<SmsRecoverySummary> {
  const [summary] = await db
    .select({
      delivered: sql<number>`count(*) filter (where ${smsLogs.status} = 'delivered')::int`,
      failed: sql<number>`count(*) filter (where ${smsLogs.status} = 'failed')::int`,
      pending: sql<number>`count(*) filter (where ${smsLogs.status} in ('queued', 'sent'))::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(smsLogs)
    .where(where);

  return summary;
}

interface SmsRecoveryRow {
  meter: {
    meterNumber: string;
  } | null;
  smsLog: {
    createdAt: Date;
    id: string;
    messageBody: string;
    phoneNumber: string;
    provider: "hostpinnacle" | "textsms";
    providerErrorCode: string | null;
    providerStatus: string | null;
    status: string;
  };
  transaction: {
    transactionId: string;
  } | null;
}

function toSmsRecoveryItem(row: SmsRecoveryRow): SmsRecoveryItem {
  const transaction =
    row.transaction && row.meter
      ? {
          meter: {
            meterNumber: row.meter.meterNumber,
          },
          transactionId: row.transaction.transactionId,
        }
      : null;

  return {
    createdAt: row.smsLog.createdAt,
    id: row.smsLog.id,
    messageBody: redactTokensInText(row.smsLog.messageBody),
    phoneNumber: row.smsLog.phoneNumber,
    provider: row.smsLog.provider,
    providerErrorCode: row.smsLog.providerErrorCode,
    providerStatus: row.smsLog.providerStatus,
    retryEligible: row.smsLog.status !== "delivered",
    status: row.smsLog.status,
    transaction,
  };
}

function emptyRecoveryList(): SmsRecoveryListResult {
  return {
    items: [],
    summary: { delivered: 0, failed: 0, pending: 0, total: 0 },
  };
}

async function loadSmsRecoveryScopeTargets(
  smsLogIds: string[],
): Promise<SmsRecoveryScopeTarget[]> {
  if (smsLogIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: smsLogs.id,
      meterNumber: meters.meterNumber,
      phoneNumber: smsLogs.phoneNumber,
      transactionId: transactions.transactionId,
    })
    .from(smsLogs)
    .leftJoin(transactions, eq(smsLogs.transactionId, transactions.id))
    .leftJoin(meters, eq(transactions.meterId, meters.id))
    .where(inArray(smsLogs.id, smsLogIds));
}
