import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { smsLogs, transactions } from "../db/schema";
import { revealToken } from "../lib/token-protection";
import { maskToken } from "../lib/token-redaction";
import { toNumber } from "./landlord-dashboard.utils";
import type { TenantAccessSummary } from "./tenant-access.types";
import type {
  TenantTokenDeliveryDetail,
  TenantTokenDeliveryItem,
} from "./tenant-dashboard.types";
import { findLatestTenantCreditToken } from "./tenant-token.utils";

interface TenantTokenDeliveryRecord {
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
  mpesaReceiptNumber: string;
  netAmount: string;
  transactionId: string;
  unitsPurchased: string;
}

interface TenantSmsDeliveryRecord {
  createdAt: Date;
  id: string;
  provider: "hostpinnacle" | "textsms";
  providerDeliveredAt: Date | null;
  providerErrorCode: string | null;
  providerReceivedAt: Date | null;
  providerStatus: string | null;
  status: "delivered" | "failed" | "queued" | "sent";
  updatedAt: Date;
}

export async function listTenantTokenDeliveries(
  tenantAccess: TenantAccessSummary,
  input: {
    limit?: number;
    offset?: number;
    status?: "pending_token" | "token_available";
  },
): Promise<TenantTokenDeliveryItem[]> {
  const records = await loadTenantTokenDeliveryRecords(tenantAccess, input);

  return records
    .map((record) => toTenantTokenDeliveryBase(record))
    .filter((item) => input.status === undefined || item.status === input.status);
}

export async function getTenantTokenDeliveryDetail(
  tenantAccess: TenantAccessSummary,
  transactionReference: string,
): Promise<TenantTokenDeliveryDetail | null> {
  const records = (await db.query.transactions.findMany({
    where: and(
      eq(transactions.meterId, tenantAccess.meterId),
      eq(transactions.status, "completed"),
      eq(transactions.transactionId, transactionReference),
    ),
    columns: {
      completedAt: true,
      createdAt: true,
      mpesaReceiptNumber: true,
      netAmount: true,
      paymentMethod: true,
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
    limit: 1,
  })) as TenantTokenDeliveryRecord[];

  if (records.length === 0) {
    return null;
  }
  const record = records[0];
  const transactionRow = await db.query.transactions.findFirst({
    where: eq(transactions.transactionId, transactionReference),
    columns: { id: true },
  });
  if (transactionRow === undefined) {
    return null;
  }
  const smsLogRows = (await db.query.smsLogs.findMany({
    where: eq(smsLogs.transactionId, transactionRow.id),
    columns: {
      createdAt: true,
      id: true,
      provider: true,
      providerDeliveredAt: true,
      providerErrorCode: true,
      providerReceivedAt: true,
      providerStatus: true,
      status: true,
      updatedAt: true,
    },
  })) as TenantSmsDeliveryRecord[];

  const sortedSmsLogs = [...smsLogRows].sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
  );
  const latestSms = sortedSmsLogs.length === 0 ? null : sortedSmsLogs[0];

  return {
    ...toTenantTokenDeliveryBase(record),
    smsDelivery:
      latestSms === null
        ? null
        : {
            createdAt: latestSms.createdAt.toISOString(),
            deliveredAt: latestSms.providerDeliveredAt?.toISOString() ?? null,
            errorCode: latestSms.providerErrorCode,
            id: latestSms.id,
            provider: latestSms.provider,
            providerStatus: latestSms.providerStatus,
            receivedAt: latestSms.providerReceivedAt?.toISOString() ?? null,
            status: latestSms.status,
            updatedAt: latestSms.updatedAt.toISOString(),
          },
  };
}

function toTenantTokenDeliveryBase(
  record: TenantTokenDeliveryRecord,
): TenantTokenDeliveryItem {
  const creditToken = findLatestTenantCreditToken(record.generatedTokens);

  const status: TenantTokenDeliveryItem["status"] =
    creditToken === null ? "pending_token" : "token_available";

  return {
    completedAt: record.completedAt?.toISOString() ?? null,
    maskedToken:
      creditToken === null ? null : maskToken(revealToken(creditToken.token)),
    meterCreditAmount: toNumber(record.netAmount).toFixed(2),
    mpesaReceiptNumber: record.mpesaReceiptNumber,
    status,
    tokenGeneratedAt:
      creditToken === null ? null : creditToken.createdAt.toISOString(),
    transactionId: record.transactionId,
    unitsPurchased: toNumber(record.unitsPurchased).toFixed(4),
  };
}

async function loadTenantTokenDeliveryRecords(
  tenantAccess: TenantAccessSummary,
  input: {
    limit?: number;
    offset?: number;
  },
) {
  return (await db.query.transactions.findMany({
    where: and(
      eq(transactions.meterId, tenantAccess.meterId),
      eq(transactions.status, "completed"),
    ),
    columns: {
      completedAt: true,
      mpesaReceiptNumber: true,
      netAmount: true,
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
    orderBy: [desc(transactions.completedAt), desc(transactions.createdAt)],
    limit: input.limit ?? 20,
    offset: input.offset ?? 0,
  })) as TenantTokenDeliveryRecord[];
}
