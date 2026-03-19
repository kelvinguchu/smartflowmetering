import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "../db";
import {
  failedTransactions,
  generatedTokens,
  meters,
  smsLogs,
  transactions,
} from "../db/schema";
import {
  isAllowedKenyanPhoneNumber,
  normalizeKenyanPhoneNumber,
} from "../lib/staff-contact";
import { revealToken } from "../lib/token-protection";
import { maskToken, redactTokensInText } from "../lib/token-redaction";
import type { SupportRecoveryQuery } from "../validators/support-recovery";
import { parseGomelongFailureDetails } from "./meter-providers/gomelong-failure-policy";
import { buildSupportRecoveryAssessment } from "./support-recovery-assessment.service";
import type {
  SupportRecoveryMeterSummary,
  SupportRecoveryResult,
  SupportRecoverySearchCriteria,
} from "./support-recovery.types";

const ADMIN_TOKEN_TYPES = [
  "clear_credit",
  "clear_tamper",
  "key_change",
  "set_power_limit",
] as const;

export async function findSupportRecovery(
  query: SupportRecoveryQuery,
  options: {
    includeAdminTokens: boolean;
  },
): Promise<SupportRecoveryResult> {
  const criteria = normalizeCriteria(query);
  const directMeter = (await findMeter(criteria.meterNumber)) ?? null;
  if (criteria.meterNumber && directMeter === null) {
    return emptySupportRecovery(criteria);
  }

  const directMeterId = directMeter?.id;

  const transactionRows = await findTransactions(criteria, directMeterId);
  const failedTransactionByMpesaId =
    await findFailedTransactionsByMpesaId(transactionRows);
  const resolvedMeterId = directMeterId ?? transactionRows[0]?.meter.id;
  let meterSummary: SupportRecoveryMeterSummary | null = null;
  if (directMeter !== null) {
    meterSummary = toMeterSummary(directMeter);
  } else if (transactionRows.length > 0) {
    meterSummary = toMeterSummary(transactionRows[0].meter);
  }

  return {
    meter: meterSummary,
    recentAdminTokens: options.includeAdminTokens
      ? await findRecentAdminTokens(resolvedMeterId)
      : [],
    recentSmsLogs: await findRecentSmsLogs(
      criteria.phoneNumber,
      transactionRows,
    ),
    search: criteria,
    transactions: transactionRows.map((transaction) => ({
      amountPaid: transaction.amountPaid,
      completedAt: transaction.completedAt,
      createdAt: transaction.createdAt,
      generatedTokens: transaction.generatedTokens.map((token) => ({
        createdAt: token.createdAt,
        maskedToken: maskToken(revealToken(token.token)),
        tokenType: token.tokenType,
        value: token.value,
      })),
      id: transaction.id,
      meter: toMeterSummary(transaction.meter),
      mpesaReceiptNumber: transaction.mpesaReceiptNumber,
      phoneNumber: transaction.phoneNumber,
      recoveryAssessment: buildSupportRecoveryAssessment({
        generatedTokens: transaction.generatedTokens,
        providerFailure: parseGomelongFailureDetails(
          transaction.mpesaTransactionId
            ? (failedTransactionByMpesaId.get(transaction.mpesaTransactionId)
                ?.failureDetails ?? null)
            : null,
        ),
        smsLogs: transaction.smsLogs,
        status: transaction.status,
      }),
      smsLogs: transaction.smsLogs.map((log) => ({
        createdAt: log.createdAt,
        id: log.id,
        messageBody: redactTokensInText(log.messageBody),
        provider: log.provider,
        status: log.status,
      })),
      status: transaction.status,
      transactionId: transaction.transactionId,
      unitsPurchased: transaction.unitsPurchased,
    })),
  };
}

async function findMeter(meterNumber: string | undefined) {
  if (!meterNumber) {
    return null;
  }

  return db.query.meters.findFirst({
    where: eq(meters.meterNumber, meterNumber),
    with: {
      motherMeter: { columns: { motherMeterNumber: true } },
      tariff: { columns: { name: true, ratePerKwh: true } },
    },
  });
}

async function findTransactions(
  criteria: SupportRecoverySearchCriteria,
  meterId?: string,
) {
  const exactFilters = [];
  if (criteria.phoneNumber) {
    exactFilters.push(eq(transactions.phoneNumber, criteria.phoneNumber));
  }
  if (criteria.transactionId) {
    exactFilters.push(eq(transactions.transactionId, criteria.transactionId));
  }
  if (criteria.mpesaReceiptNumber) {
    exactFilters.push(
      eq(transactions.mpesaReceiptNumber, criteria.mpesaReceiptNumber),
    );
  }
  if (meterId) {
    exactFilters.push(eq(transactions.meterId, meterId));
  }

  let where;
  if (criteria.q && exactFilters.length > 0) {
    where = or(...exactFilters);
  } else if (exactFilters.length === 1) {
    where = exactFilters[0];
  } else if (exactFilters.length > 1) {
    where = and(...exactFilters);
  }

  if (!where) {
    return [];
  }

  return db.query.transactions.findMany({
    where,
    with: {
      generatedTokens: {
        columns: { createdAt: true, token: true, tokenType: true, value: true },
      },
      meter: {
        columns: {
          brand: true,
          id: true,
          meterNumber: true,
          meterType: true,
          status: true,
        },
        with: {
          motherMeter: { columns: { motherMeterNumber: true } },
          tariff: { columns: { name: true, ratePerKwh: true } },
        },
      },
      smsLogs: {
        columns: {
          createdAt: true,
          id: true,
          messageBody: true,
          provider: true,
          status: true,
        },
      },
    },
    columns: {
      amountPaid: true,
      completedAt: true,
      createdAt: true,
      id: true,
      meterId: true,
      mpesaReceiptNumber: true,
      mpesaTransactionId: true,
      phoneNumber: true,
      status: true,
      transactionId: true,
      unitsPurchased: true,
    },
    orderBy: [desc(transactions.createdAt)],
    limit: 10,
  });
}

async function findFailedTransactionsByMpesaId(
  transactionRows: Awaited<ReturnType<typeof findTransactions>>,
) {
  const mpesaTransactionIds = transactionRows
    .map((transaction) => transaction.mpesaTransactionId)
    .filter((value): value is string => Boolean(value));
  if (mpesaTransactionIds.length === 0) {
    return new Map<
      string,
      { failureDetails: string | null; failureReason: string }
    >();
  }

  const rows = await db.query.failedTransactions.findMany({
    where: inArray(failedTransactions.mpesaTransactionId, mpesaTransactionIds),
    columns: {
      failureDetails: true,
      failureReason: true,
      mpesaTransactionId: true,
    },
    orderBy: [desc(failedTransactions.createdAt)],
  });

  return rows.reduce((map, row) => {
    if (!map.has(row.mpesaTransactionId)) {
      map.set(row.mpesaTransactionId, {
        failureDetails: row.failureDetails,
        failureReason: row.failureReason,
      });
    }

    return map;
  }, new Map<string, { failureDetails: string | null; failureReason: string }>());
}

async function findRecentAdminTokens(meterId: string | undefined) {
  if (!meterId) {
    return [];
  }

  const tokens = await db.query.generatedTokens.findMany({
    where: and(
      eq(generatedTokens.meterId, meterId),
      inArray(generatedTokens.tokenType, [...ADMIN_TOKEN_TYPES]),
    ),
    orderBy: [desc(generatedTokens.createdAt)],
    limit: 5,
  });

  return tokens.map((token) => ({
    createdAt: token.createdAt,
    maskedToken: maskToken(revealToken(token.token)),
    tokenType: token.tokenType,
  }));
}

async function findRecentSmsLogs(
  searchPhoneNumber: string | undefined,
  transactionRows: Awaited<ReturnType<typeof findTransactions>>,
) {
  const phoneNumbers = [
    ...new Set([
      ...(searchPhoneNumber ? [searchPhoneNumber] : []),
      ...transactionRows.map((transaction) => transaction.phoneNumber),
    ]),
  ];
  if (phoneNumbers.length === 0) {
    return [];
  }

  const logs = await db.query.smsLogs.findMany({
    where: inArray(smsLogs.phoneNumber, phoneNumbers),
    columns: {
      createdAt: true,
      id: true,
      messageBody: true,
      phoneNumber: true,
      provider: true,
      status: true,
    },
    orderBy: [desc(smsLogs.createdAt)],
    limit: 10,
  });

  return logs.map((log) => ({
    createdAt: log.createdAt,
    id: log.id,
    messageBody: redactTokensInText(log.messageBody),
    phoneNumber: log.phoneNumber,
    provider: log.provider,
    status: log.status,
  }));
}

function normalizeCriteria(
  query: SupportRecoveryQuery,
): SupportRecoverySearchCriteria {
  const q = query.q?.trim();
  return {
    meterNumber: query.meterNumber?.trim() ?? q,
    mpesaReceiptNumber: query.mpesaReceiptNumber?.trim() ?? q,
    phoneNumber: normalizePhoneNumber(query.phoneNumber ?? q),
    q,
    transactionId: query.transactionId?.trim() ?? q,
  };
}

function normalizePhoneNumber(
  phoneNumber: string | undefined,
): string | undefined {
  if (!phoneNumber) {
    return undefined;
  }

  return isAllowedKenyanPhoneNumber(phoneNumber)
    ? normalizeKenyanPhoneNumber(phoneNumber)
    : phoneNumber.trim();
}

function toMeterSummary(meter: {
  brand: string;
  id: string;
  meterNumber: string;
  meterType: string;
  motherMeter: { motherMeterNumber: string } | null;
  status: string;
  tariff: { name: string; ratePerKwh: string } | null;
}): SupportRecoveryMeterSummary {
  return {
    brand: meter.brand,
    meterNumber: meter.meterNumber,
    meterType: meter.meterType,
    motherMeterNumber: meter.motherMeter?.motherMeterNumber ?? null,
    status: meter.status,
    tariff: meter.tariff
      ? {
          name: meter.tariff.name,
          ratePerKwh: meter.tariff.ratePerKwh,
        }
      : null,
  };
}

function emptySupportRecovery(
  search: SupportRecoverySearchCriteria,
): SupportRecoveryResult {
  return {
    meter: null,
    recentAdminTokens: [],
    recentSmsLogs: [],
    search,
    transactions: [],
  };
}
