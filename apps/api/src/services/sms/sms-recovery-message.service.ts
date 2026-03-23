import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { generatedTokens, smsLogs, transactions } from "../../db/schema";
import { revealToken } from "../../lib/token-protection";
import { formatTokenSms } from "./sms.service";

export async function resolveSmsMessageBody(
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
      and(
        eq(generatedTokens.transactionId, transactions.id),
        eq(generatedTokens.tokenType, "credit"),
      ),
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



