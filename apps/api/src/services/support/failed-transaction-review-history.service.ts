import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { auditLogs } from "../../db/schema";
const FAILED_TRANSACTION_STATUSES = [
  "pending_review",
  "refunded",
  "resolved",
  "abandoned",
] as const;

const FAILED_TRANSACTION_RESOLUTION_ACTIONS = [
  "abandoned_after_customer_follow_up",
  "customer_advised_to_retry_above_minimum",
  "customer_confirmed_correct_meter_for_retry",
  "manual_review_documented",
  "meter_status_follow_up_completed",
  "provider_issue_reviewed_for_retry_or_refund",
  "refund_completed",
  "token_resent_or_delivered_via_alternate_channel",
] as const;

type ReviewStatus = (typeof FAILED_TRANSACTION_STATUSES)[number];
type ReviewResolutionAction =
  (typeof FAILED_TRANSACTION_RESOLUTION_ACTIONS)[number];

interface ReviewDetailRecord {
  actorUserId?: string | null;
  newStatus?: ReviewStatus | null;
  previousStatus?: ReviewStatus | null;
  resolutionAction?: ReviewResolutionAction | null;
  resolutionNotes?: string | null;
}

export interface FailedTransactionReviewEntry {
  actorUserId: string | null;
  createdAt: Date;
  newStatus: ReviewStatus | null;
  previousStatus: ReviewStatus | null;
  resolutionAction: ReviewResolutionAction | null;
  resolutionNotes: string | null;
}

export async function loadFailedTransactionReviewHistory(
  failedTransactionIds: string[],
): Promise<Map<string, FailedTransactionReviewEntry[]>> {
  const uniqueIds = [...new Set(failedTransactionIds)];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const rows = await db.query.auditLogs.findMany({
    where: and(
      eq(auditLogs.action, "failed_transaction_status_updated"),
      eq(auditLogs.entityType, "failed_transaction"),
      inArray(auditLogs.entityId, uniqueIds),
    ),
    columns: {
      createdAt: true,
      details: true,
      entityId: true,
    },
    orderBy: [desc(auditLogs.createdAt)],
  });

  return rows.reduce((historyMap, row) => {
    const parsed = parseReviewDetails(
      row.createdAt,
      row.details as ReviewDetailRecord | null,
    );
    if (!historyMap.has(row.entityId)) {
      historyMap.set(row.entityId, []);
    }
    historyMap.get(row.entityId)?.push(parsed);
    return historyMap;
  }, new Map<string, FailedTransactionReviewEntry[]>());
}

function parseReviewDetails(
  createdAt: Date,
  details: ReviewDetailRecord | null,
): FailedTransactionReviewEntry {
  return {
    actorUserId: toOptionalString(details?.actorUserId),
    createdAt,
    newStatus: toOptionalStatus(details?.newStatus),
    previousStatus: toOptionalStatus(details?.previousStatus),
    resolutionAction: toOptionalResolutionAction(details?.resolutionAction),
    resolutionNotes: toOptionalString(details?.resolutionNotes),
  };
}

function toOptionalString(value: string | null | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toOptionalStatus(
  value: string | null | undefined,
): ReviewStatus | null {
  return FAILED_TRANSACTION_STATUSES.includes(value as ReviewStatus)
    ? (value as ReviewStatus)
    : null;
}

function toOptionalResolutionAction(
  value: string | null | undefined,
): ReviewResolutionAction | null {
  return FAILED_TRANSACTION_RESOLUTION_ACTIONS.includes(
    value as ReviewResolutionAction,
  )
    ? (value as ReviewResolutionAction)
    : null;
}


