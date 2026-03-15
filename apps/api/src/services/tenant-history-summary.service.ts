import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { transactions } from "../db/schema";
import { toNumber } from "./landlord-dashboard.utils";
import type { TenantAccessSummary } from "./tenant-access.types";
import type { TenantHistorySummary } from "./tenant-history.types";

interface TenantHistorySummaryInput {
  endDate?: string;
  startDate?: string;
}

export async function getTenantHistorySummary(
  tenantAccess: TenantAccessSummary,
  input: TenantHistorySummaryInput,
): Promise<TenantHistorySummary> {
  const filters = [eq(transactions.meterId, tenantAccess.meterId)];
  if (input.startDate) {
    filters.push(gte(transactions.createdAt, new Date(input.startDate)));
  }
  if (input.endDate) {
    filters.push(lte(transactions.createdAt, new Date(input.endDate)));
  }

  const rows = await db
    .select({
      completedCount:
        sql<number>`count(${transactions.id}) filter (where ${transactions.status} = 'completed')::int`,
      failedCount:
        sql<number>`count(${transactions.id}) filter (where ${transactions.status} = 'failed')::int`,
      firstCompletedPurchaseAt:
        sql<string | null>`min(${transactions.completedAt}) filter (where ${transactions.status} = 'completed')`,
      lastCompletedPurchaseAt:
        sql<string | null>`max(${transactions.completedAt}) filter (where ${transactions.status} = 'completed')`,
      paybillCompletedCount:
        sql<number>`count(${transactions.id}) filter (where ${transactions.status} = 'completed' and ${transactions.paymentMethod} = 'paybill')::int`,
      pendingCount:
        sql<number>`count(${transactions.id}) filter (where ${transactions.status} = 'pending')::int`,
      processingCount:
        sql<number>`count(${transactions.id}) filter (where ${transactions.status} = 'processing')::int`,
      stkPushCompletedCount:
        sql<number>`count(${transactions.id}) filter (where ${transactions.status} = 'completed' and ${transactions.paymentMethod} = 'stk_push')::int`,
      totalMeterCreditAmount:
        sql<string>`coalesce(sum(case when ${transactions.status} = 'completed' then ${transactions.netAmount}::numeric else 0 end), 0)::text`,
      totalUnitsPurchased:
        sql<string>`coalesce(sum(case when ${transactions.status} = 'completed' then ${transactions.unitsPurchased}::numeric else 0 end), 0)::text`,
    })
    .from(transactions)
    .where(and(...filters))
    .limit(1);

  const row = rows[0];

  return {
    paymentMethodBreakdown: {
      paybillCompletedCount: row?.paybillCompletedCount ?? 0,
      stkPushCompletedCount: row?.stkPushCompletedCount ?? 0,
    },
    period: {
      endDate: input.endDate ?? null,
      startDate: input.startDate ?? null,
    },
    statusBreakdown: {
      completed: row?.completedCount ?? 0,
      failed: row?.failedCount ?? 0,
      pending: row?.pendingCount ?? 0,
      processing: row?.processingCount ?? 0,
    },
    summary: {
      firstCompletedPurchaseAt: row?.firstCompletedPurchaseAt ?? null,
      lastCompletedPurchaseAt: row?.lastCompletedPurchaseAt ?? null,
      totalCompletedPurchases: row?.completedCount ?? 0,
      totalMeterCreditAmount: toNumber(row?.totalMeterCreditAmount).toFixed(2),
      totalUnitsPurchased: toNumber(row?.totalUnitsPurchased).toFixed(4),
    },
  };
}
