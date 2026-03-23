import { revealToken } from "../lib/token-protection";
import { maskToken, redactTokensInText } from "../lib/token-redaction";

export function toTransactionListItem(
  transaction: {
    amountPaid: string;
    commissionAmount?: string;
    completedAt: Date | null;
    createdAt: Date;
    generatedTokens: Array<{
      id: string;
      token: string;
      tokenType: string;
      value: string | null;
    }>;
    id: string;
    meter: {
      id: string;
      meterNumber: string;
      meterType: string;
    };
    mpesaReceiptNumber: string;
    netAmount?: string;
    paymentMethod: string;
    phoneNumber: string;
    status: string;
    transactionId: string;
    unitsPurchased: string;
  },
  options: { includeFinancialBreakdown: boolean },
) {
  return {
    amountPaid: transaction.amountPaid,
    completedAt: transaction.completedAt,
    createdAt: transaction.createdAt,
    generatedTokens: transaction.generatedTokens.map((token) => ({
      ...token,
      token: maskToken(revealToken(token.token)),
    })),
    id: transaction.id,
    meter: transaction.meter,
    mpesaReceiptNumber: transaction.mpesaReceiptNumber,
    paymentMethod: transaction.paymentMethod,
    phoneNumber: transaction.phoneNumber,
    status: transaction.status,
    transactionId: transaction.transactionId,
    unitsPurchased: transaction.unitsPurchased,
    ...(options.includeFinancialBreakdown
      ? {
          commissionAmount: transaction.commissionAmount,
          netAmount: transaction.netAmount,
        }
      : {}),
  };
}

export function toTransactionDetail(transaction: {
  amountPaid: string;
  commissionAmount: string;
  completedAt: Date | null;
  createdAt: Date;
  generatedTokens: Array<Record<string, unknown> & { token: string }>;
  id: string;
  meter: unknown;
  mpesaReceiptNumber: string;
  mpesaTransaction: unknown;
  netAmount: string;
  paymentMethod: string;
  phoneNumber: string;
  smsLogs: Array<Record<string, unknown> & { messageBody: string }>;
  status: string;
  transactionId: string;
  unitsPurchased: string;
}) {
  return {
    amountPaid: transaction.amountPaid,
    commissionAmount: transaction.commissionAmount,
    completedAt: transaction.completedAt,
    createdAt: transaction.createdAt,
    generatedTokens: transaction.generatedTokens.map((token) => ({
      ...token,
      token: maskToken(revealToken(token.token)),
    })),
    id: transaction.id,
    meter: transaction.meter,
    mpesaReceiptNumber: transaction.mpesaReceiptNumber,
    mpesaTransaction: transaction.mpesaTransaction,
    netAmount: transaction.netAmount,
    paymentMethod: transaction.paymentMethod,
    phoneNumber: transaction.phoneNumber,
    smsLogs: transaction.smsLogs.map((smsLog) => ({
      ...smsLog,
      messageBody: redactTokensInText(smsLog.messageBody),
    })),
    status: transaction.status,
    transactionId: transaction.transactionId,
    unitsPurchased: transaction.unitsPurchased,
  };
}
