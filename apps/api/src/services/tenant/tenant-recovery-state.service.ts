import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { customerAppNotifications, transactions } from "../../db/schema";
import { revealToken } from "../../lib/token-protection";
import { maskToken } from "../../lib/token-redaction";
import { toNumber } from "../landlord/landlord-dashboard.utils";
import type { TenantAccessSummary } from "./tenant-access.types";
import type { TenantRecoveryStateItem } from "./tenant-history.types";
import { findLatestTenantCreditToken } from "./tenant-token.utils";

interface TenantRecoveryStateInput {
  limit?: number;
  offset?: number;
}

interface TenantRecoveryTransactionRecord {
  completedAt: Date | null;
  generatedTokens: {
    createdAt: Date;
    token: string;
    tokenType:
      | "clear_credit"
      | "clear_tamper"
      | "credit"
      | "key_change"
      | "set_power_limit";
  }[];
  netAmount: string;
  paymentMethod: "paybill" | "stk_push";
  status: "completed" | "failed" | "pending" | "processing";
  transactionId: string;
  unitsPurchased: string;
}

export async function listTenantRecoveryStates(
  tenantAccess: TenantAccessSummary,
  input: TenantRecoveryStateInput,
): Promise<TenantRecoveryStateItem[]> {
  const records = (await db.query.transactions.findMany({
    where: eq(transactions.meterId, tenantAccess.meterId),
    columns: {
      completedAt: true,
      netAmount: true,
      paymentMethod: true,
      status: true,
      transactionId: true,
      unitsPurchased: true,
    },
    with: {
      generatedTokens: {
        columns: {
          createdAt: true,
          token: true,
          tokenType: true,
        },
      },
    },
    orderBy: [desc(transactions.createdAt)],
    limit: input.limit ?? 20,
    offset: input.offset ?? 0,
  })) as TenantRecoveryTransactionRecord[];

  const notificationStates = await loadTenantTokenAcknowledgementStates(
    tenantAccess.id,
    records.map((record) => record.transactionId),
  );

  return records.map((record) => {
    const creditToken = findLatestTenantCreditToken(record.generatedTokens);
    const notificationState =
      notificationStates.get(record.transactionId) ?? "missing";

    return {
      completedAt: record.completedAt?.toISOString() ?? null,
      maskedToken:
        creditToken === null ? null : maskToken(revealToken(creditToken.token)),
      meterCreditAmount: toNumber(record.netAmount).toFixed(2),
      paymentMethod: record.paymentMethod,
      paymentStatus: record.status,
      recoveryState: mapTenantRecoveryState(record.status, creditToken !== null, notificationState),
      tokenGeneratedAt: creditToken?.createdAt.toISOString() ?? null,
      transactionId: record.transactionId,
      unitsPurchased: toNumber(record.unitsPurchased).toFixed(4),
    };
  });
}

async function loadTenantTokenAcknowledgementStates(
  tenantAccessId: string,
  transactionIds: string[],
) {
  if (transactionIds.length === 0) {
    return new Map<string, "missing" | "read" | "sent">();
  }

  const rows = await db
    .select({
      readAt: customerAppNotifications.readAt,
      referenceId: customerAppNotifications.referenceId,
      status: customerAppNotifications.status,
    })
    .from(customerAppNotifications)
    .where(
      and(
        eq(customerAppNotifications.tenantAccessId, tenantAccessId),
        eq(customerAppNotifications.type, "token_delivery_available"),
        inArray(customerAppNotifications.referenceId, transactionIds),
      ),
    );

  return rows.reduce<Map<string, "missing" | "read" | "sent">>((map, row) => {
    const nextState = row.readAt ? "read" : "sent";
    const current = map.get(row.referenceId);
    if (current === "read") {
      return map;
    }
    map.set(row.referenceId, nextState);
    return map;
  }, new Map());
}

function mapTenantRecoveryState(
  paymentStatus: "completed" | "failed" | "pending" | "processing",
  hasCreditToken: boolean,
  notificationState: "missing" | "read" | "sent",
): TenantRecoveryStateItem["recoveryState"] {
  if (paymentStatus === "failed") {
    return "payment_failed";
  }
  if (paymentStatus === "pending") {
    return "payment_pending";
  }
  if (paymentStatus === "processing") {
    return "payment_processing";
  }
  if (!hasCreditToken) {
    return "token_pending_generation";
  }
  if (notificationState === "read") {
    return "token_acknowledged";
  }

  return "token_available";
}
