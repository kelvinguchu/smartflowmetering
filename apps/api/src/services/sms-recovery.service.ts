import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { generatedTokens, meters, smsLogs, transactions } from "../db/schema";
import { normalizeKenyanPhoneNumber } from "../lib/staff-contact";
import { revealToken } from "../lib/token-protection";
import { redactTokensInText } from "../lib/token-redaction";
import { smsDeliveryQueue } from "../queues";
import type { SmsRecoveryListQuery } from "../validators/sms-recovery";
import type {
  SmsRecoveryItem,
  SmsRecoveryListResult,
  SmsRecoverySummary,
} from "./sms-recovery.types";
import { formatTokenSms } from "./sms.service";

const PENDING_SMS_STATUSES = ["queued", "sent"] as const;

export async function listSmsRecoveryEntries(
  query: SmsRecoveryListQuery,
): Promise<SmsRecoveryListResult> {
  const criteria = normalizeCriteria(query);
  const meterId = await findMeterId(criteria.meterNumber);
  if (criteria.meterNumber && !meterId) {
    return emptyRecoveryList();
  }

  const transactionIds = await findTransactionIds(criteria.transactionId, meterId);
  if ((criteria.transactionId || meterId) && transactionIds.length === 0) {
    return emptyRecoveryList();
  }

  const where = buildSmsRecoveryWhere(criteria.phoneNumber, transactionIds, criteria.deliveryState);
  if (!where) {
    return emptyRecoveryList();
  }

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  const [rows, summary] = await Promise.all([
    db
      .select({
        smsLog: smsLogs,
        transaction: {
          id: transactions.id,
          transactionId: transactions.transactionId,
        },
        meter: {
          id: meters.id,
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

export async function queueSmsRetryById(smsLogId: string): Promise<{ jobId: string; smsLogId: string }> {
  const log = await db.query.smsLogs.findFirst({
    where: eq(smsLogs.id, smsLogId),
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

async function resolveSmsMessageBody(
  smsLogId: string,
  fallbackMessageBody: string,
): Promise<string> {
  const records = await db
    .select({
      token: generatedTokens.token,
      tokenValue: generatedTokens.value,
      transactionId: smsLogs.transactionId,
    })
    .from(smsLogs)
    .leftJoin(transactions, eq(smsLogs.transactionId, transactions.id))
    .leftJoin(
      generatedTokens,
      and(eq(generatedTokens.transactionId, transactions.id), eq(generatedTokens.tokenType, "credit")),
    )
    .where(eq(smsLogs.id, smsLogId))
    .orderBy(desc(generatedTokens.createdAt))
    .limit(1);

  if (records.length === 0) {
    return fallbackMessageBody;
  }

  const [record] = records;
  if (record.transactionId === null || record.token === null) {
    return fallbackMessageBody;
  }

  const transaction = await db.query.transactions.findFirst({
    where: eq(transactions.id, record.transactionId),
    columns: {
      amountPaid: true,
      commissionAmount: true,
      completedAt: true,
      createdAt: true,
      netAmount: true,
    },
    with: {
      meter: {
        columns: { meterNumber: true },
      },
    },
  });

  if (!transaction) {
    return fallbackMessageBody;
  }

  return formatTokenSms({
    amountPaid: transaction.amountPaid,
    meterNumber: transaction.meter.meterNumber,
    otherCharges: transaction.commissionAmount,
    token: revealToken(record.token),
    tokenAmount: transaction.netAmount,
    transactionDate: transaction.completedAt ?? transaction.createdAt,
    units: record.tokenValue ?? "0",
  });
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

function normalizePhoneNumber(phoneNumber: string | undefined): string | undefined {
  if (!phoneNumber) {
    return undefined;
  }

  try {
    return normalizeKenyanPhoneNumber(phoneNumber);
  } catch {
    return phoneNumber.trim();
  }
}

async function findMeterId(meterNumber: string | undefined): Promise<string | undefined> {
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

function buildDeliveryStateFilter(deliveryState: SmsRecoveryListQuery["deliveryState"]) {
  switch (deliveryState) {
    case "delivered":
      return eq(smsLogs.status, "delivered");
    case "pending":
      return inArray(smsLogs.status, [...PENDING_SMS_STATUSES]);
    case "all":
      return or(
        eq(smsLogs.status, "delivered"),
        eq(smsLogs.status, "failed"),
        inArray(smsLogs.status, [...PENDING_SMS_STATUSES]),
      ) ?? sql`true`;
    case "failed":
    default:
      return eq(smsLogs.status, "failed");
  }
}

async function loadSmsRecoverySummary(where: ReturnType<typeof buildSmsRecoveryWhere>): Promise<SmsRecoverySummary> {
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
  meter:
    | {
        id: string;
        meterNumber: string;
      }
    | null;
  smsLog: typeof smsLogs.$inferSelect;
  transaction:
    | {
        id: string;
        transactionId: string;
      }
    | null;
}

function toSmsRecoveryItem(row: SmsRecoveryRow): SmsRecoveryItem {
  const transaction =
    row.transaction && row.meter
      ? {
          id: row.transaction.id,
          meter: {
            id: row.meter.id,
            meterNumber: row.meter.meterNumber,
          },
          transactionId: row.transaction.transactionId,
        }
      : null;

  return {
    cost: row.smsLog.cost,
    createdAt: row.smsLog.createdAt,
    id: row.smsLog.id,
    messageBody: redactTokensInText(row.smsLog.messageBody),
    phoneNumber: row.smsLog.phoneNumber,
    providerErrorCode: row.smsLog.providerErrorCode,
    providerMessageId: row.smsLog.providerMessageId,
    providerStatus: row.smsLog.providerStatus,
    retryEligible: row.smsLog.status !== "delivered",
    status: row.smsLog.status,
    transaction,
    updatedAt: row.smsLog.updatedAt,
  };
}

function emptyRecoveryList(): SmsRecoveryListResult {
  return {
    items: [],
    summary: { delivered: 0, failed: 0, pending: 0, total: 0 },
  };
}
