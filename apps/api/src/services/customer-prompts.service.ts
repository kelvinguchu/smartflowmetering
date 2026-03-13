import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { env } from "../config";
import { db } from "../db";
import {
  customerAppNotifications,
  failedTransactions,
  meters,
  transactions,
} from "../db/schema";
import type {
  CustomerPromptListQuery,
  CustomerPromptQueueInput,
} from "../validators/customer-prompts";
import { enqueueCustomerAppNotificationDelivery } from "./app-notifications.service";
import {
  buildPromptContent,
  shouldIncludePromptType,
  summarizePromptCandidates,
  uniqueNormalizedValues,
} from "./customer-prompts.lib";
import type {
  CustomerPromptCandidate,
  CustomerPromptListResult,
  CustomerPromptQueueResult,
} from "./customer-prompts.types";

export async function listCustomerPromptCandidates(
  query: CustomerPromptListQuery,
): Promise<CustomerPromptListResult> {
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  const fetchSize = Math.min(limit + offset + 50, 200);
  const [failedPurchaseFollowUps, buyTokenNudges] = await Promise.all([
    shouldIncludePromptType(query.type, "failed_purchase_follow_up")
      ? listFailedPurchaseFollowUps(query, fetchSize)
      : Promise.resolve([]),
    shouldIncludePromptType(query.type, "buy_token_nudge")
      ? listBuyTokenNudges(query, fetchSize)
      : Promise.resolve([]),
  ]);

  const items = [...failedPurchaseFollowUps, ...buyTokenNudges].sort(
    (left, right) => toTime(right.createdAt) - toTime(left.createdAt),
  );

  return {
    items: items.slice(offset, offset + limit),
    summary: summarizePromptCandidates(items),
  };
}

export async function queueCustomerPrompts(
  input: CustomerPromptQueueInput,
): Promise<CustomerPromptQueueResult> {
  const maxPrompts = input.maxPrompts ?? input.limit ?? env.CUSTOMER_PROMPTS_MAX_PER_RUN;
  const { items, summary } = await listCustomerPromptCandidates({
    ...input,
    limit: maxPrompts,
    offset: 0,
  });
  const selected = items.slice(0, maxPrompts);
  if (selected.length === 0) {
    return { ...summary, failed: 0, queued: 0, skippedDuplicate: 0 };
  }

  const recentPromptMap = await loadRecentPromptMap(selected);
  let queued = 0;
  let skippedDuplicate = 0;
  let failed = 0;

  for (const candidate of selected) {
    if (recentPromptMap.get(candidate.dedupeKey) === true) {
      skippedDuplicate += 1;
      continue;
    }

    try {
      const content = buildPromptContent(candidate);
      const [notification] = await db.insert(customerAppNotifications).values({
        message: content.message,
        metadata: {
          amount: candidate.amount,
          dedupeKey: candidate.dedupeKey,
          meterNumber: candidate.meterNumber,
          phoneNumber: candidate.phoneNumber,
          promptType: candidate.promptType,
          referenceId: candidate.referenceId,
        },
        meterNumber: candidate.meterNumber,
        phoneNumber: candidate.phoneNumber,
        referenceId: candidate.referenceId,
        title: content.title,
        type: candidate.promptType,
      }).returning({ id: customerAppNotifications.id });
      await enqueueCustomerAppNotificationDelivery(notification.id);
      queued += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `[Customer Prompts] Failed to queue ${candidate.promptType} for ${candidate.meterNumber}:`,
        error,
      );
    }
  }

  return { ...summary, failed, queued, skippedDuplicate };
}

async function listFailedPurchaseFollowUps(
  query: CustomerPromptListQuery,
  limit: number,
): Promise<CustomerPromptCandidate[]> {
  const rows = await db.query.failedTransactions.findMany({
    where: and(
      eq(failedTransactions.status, "pending_review"),
      query.meterNumber
        ? eq(failedTransactions.meterNumberAttempted, query.meterNumber)
        : undefined,
      query.phoneNumber ? eq(failedTransactions.phoneNumber, query.phoneNumber) : undefined,
    ),
    orderBy: [desc(failedTransactions.createdAt)],
    limit,
  });
  if (rows.length === 0) {
    return [];
  }

  const phoneNumbers = uniqueNormalizedValues(rows.map((row) => row.phoneNumber));
  const meterNumbers = uniqueNormalizedValues(rows.map((row) => row.meterNumberAttempted));
  const earliestFailureAt = rows.reduce(
    (current, row) => (row.createdAt < current ? row.createdAt : current),
    rows[0].createdAt,
  );
  const successRows = await db
    .select({
      completedAt: sql<Date>`coalesce(${transactions.completedAt}, ${transactions.createdAt})`,
      meterNumber: meters.meterNumber,
      phoneNumber: transactions.phoneNumber,
    })
    .from(transactions)
    .innerJoin(meters, eq(transactions.meterId, meters.id))
    .where(
      and(
        eq(transactions.status, "completed"),
        or(
          and(
            isNotNull(transactions.completedAt),
            gte(transactions.completedAt, earliestFailureAt),
          ),
          and(
            isNull(transactions.completedAt),
            gte(transactions.createdAt, earliestFailureAt),
          ),
        ),
        inArray(transactions.phoneNumber, phoneNumbers),
        inArray(meters.meterNumber, meterNumbers),
      ),
    )
    .orderBy(desc(sql`coalesce(${transactions.completedAt}, ${transactions.createdAt})`));

  const latestSuccessByPair = new Map<string, Date>();
  for (const row of successRows) {
    const dedupeKey = `${row.phoneNumber}:${row.meterNumber}`;
    if (!latestSuccessByPair.has(dedupeKey)) {
      latestSuccessByPair.set(dedupeKey, toDate(row.completedAt));
    }
  }

  return rows
    .filter((row) => {
      const latestSuccess = latestSuccessByPair.get(
        `${row.phoneNumber}:${row.meterNumberAttempted}`,
      );
      return latestSuccess === undefined || latestSuccess <= row.createdAt;
    })
    .map((row) => ({
      amount: row.amount,
      createdAt: row.createdAt,
      dedupeKey: `failed_purchase_follow_up:${row.phoneNumber}:${row.meterNumberAttempted}`,
      meterNumber: row.meterNumberAttempted,
      phoneNumber: row.phoneNumber,
      promptType: "failed_purchase_follow_up",
      referenceId: row.id,
    }));
}

async function listBuyTokenNudges(
  query: CustomerPromptListQuery,
  limit: number,
): Promise<CustomerPromptCandidate[]> {
  const staleDays = query.staleDays ?? env.BUY_TOKEN_NUDGE_STALE_DAYS;
  const staleBefore = new Date(Date.now() - staleDays * 24 * 3_600_000);
  const rows = await db
    .select({
      lastPurchaseAt: sql<Date>`max(coalesce(${transactions.completedAt}, ${transactions.createdAt}))`,
      meterNumber: meters.meterNumber,
      phoneNumber: transactions.phoneNumber,
      transactionId: sql<string>`max(${transactions.transactionId})`,
    })
    .from(transactions)
    .innerJoin(meters, eq(transactions.meterId, meters.id))
    .where(
      and(
        eq(transactions.status, "completed"),
        or(
          and(
            isNotNull(transactions.completedAt),
            lte(transactions.completedAt, staleBefore),
          ),
          and(
            isNull(transactions.completedAt),
            lte(transactions.createdAt, staleBefore),
          ),
        ),
        query.meterNumber ? eq(meters.meterNumber, query.meterNumber) : undefined,
        query.phoneNumber ? eq(transactions.phoneNumber, query.phoneNumber) : undefined,
      ),
    )
    .groupBy(transactions.phoneNumber, meters.meterNumber)
    .orderBy(sql`max(coalesce(${transactions.completedAt}, ${transactions.createdAt})) asc`)
    .limit(limit);
  if (rows.length === 0) {
    return [];
  }

  const pendingFailurePairs = await loadPendingFailurePairs(rows);
  return rows
    .filter(
      (row) =>
        !pendingFailurePairs.has(`${row.phoneNumber}:${row.meterNumber}`),
    )
    .map((row) => ({
      amount: null,
      createdAt: toDate(row.lastPurchaseAt),
      dedupeKey: `buy_token_nudge:${row.phoneNumber}:${row.meterNumber}`,
      meterNumber: row.meterNumber,
      phoneNumber: row.phoneNumber,
      promptType: "buy_token_nudge",
      referenceId: row.transactionId,
    }));
}

async function loadPendingFailurePairs(
  rows: { meterNumber: string; phoneNumber: string }[],
): Promise<Set<string>> {
  const phoneNumbers = uniqueNormalizedValues(rows.map((row) => row.phoneNumber));
  const meterNumbers = uniqueNormalizedValues(rows.map((row) => row.meterNumber));
  const failures = await db
    .select({
      meterNumber: failedTransactions.meterNumberAttempted,
      phoneNumber: failedTransactions.phoneNumber,
    })
    .from(failedTransactions)
    .where(
      and(
        eq(failedTransactions.status, "pending_review"),
        inArray(failedTransactions.phoneNumber, phoneNumbers),
        inArray(failedTransactions.meterNumberAttempted, meterNumbers),
      ),
    );

  return new Set(
    failures.map((row) => `${row.phoneNumber}:${row.meterNumber}`),
  );
}

async function loadRecentPromptMap(candidates: CustomerPromptCandidate[]) {
  const since = new Date(
    Date.now() -
      Math.max(
        env.FAILED_PURCHASE_PROMPT_DEDUPE_HOURS,
        env.BUY_TOKEN_NUDGE_DEDUPE_HOURS,
      ) *
        3_600_000,
  );
  const logs = await db
    .select({
      createdAt: customerAppNotifications.createdAt,
      message: customerAppNotifications.message,
      phoneNumber: customerAppNotifications.phoneNumber,
      title: customerAppNotifications.title,
    })
    .from(customerAppNotifications)
    .where(
      and(
        inArray(
          customerAppNotifications.phoneNumber,
          uniqueNormalizedValues(candidates.map((item) => item.phoneNumber)),
        ),
        gte(customerAppNotifications.createdAt, since),
      ),
    );

  const sentKeys = new Map<string, boolean>();
  for (const candidate of candidates) {
    const content = buildPromptContent(candidate);
    const dedupeHours =
      candidate.promptType === "failed_purchase_follow_up"
        ? env.FAILED_PURCHASE_PROMPT_DEDUPE_HOURS
        : env.BUY_TOKEN_NUDGE_DEDUPE_HOURS;
    const candidateSince = new Date(Date.now() - dedupeHours * 3_600_000);
    const isDuplicate = logs.some(
      (log) =>
        log.phoneNumber === candidate.phoneNumber &&
        log.createdAt >= candidateSince &&
        log.message === content.message &&
        log.title === content.title,
    );
    sentKeys.set(candidate.dedupeKey, isDuplicate);
  }

  return sentKeys;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toTime(value: Date | string): number {
  return toDate(value).getTime();
}
