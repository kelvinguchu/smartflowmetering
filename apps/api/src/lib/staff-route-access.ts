import { HTTPException } from "hono/http-exception";
import type { AuthUser } from "./auth-middleware";

interface TransactionSearchQuery {
  meterNumber?: string;
  mpesaReceiptNumber?: string;
  phoneNumber?: string;
  transactionId?: string;
}

export function isAdminStaffUser(user: AuthUser): boolean {
  return user.role === "admin";
}

export function ensureAdminRouteAccess(
  user: AuthUser,
  action: string,
): void {
  if (isAdminStaffUser(user)) {
    return;
  }

  throw new HTTPException(403, {
    message: `Forbidden: ${action} is restricted to admin staff`,
  });
}

export function ensureSupportScopedTransactionSearch(
  user: AuthUser,
  query: TransactionSearchQuery,
): void {
  if (isAdminStaffUser(user)) {
    return;
  }

  if (hasSupportTransactionSearchCriteria(query)) {
    return;
  }

  throw new HTTPException(403, {
    message:
      "Forbidden: Support staff must search transactions by phone number, meter number, transaction reference, or M-Pesa receipt",
  });
}

export function hasSupportTransactionSearchCriteria(
  query: TransactionSearchQuery,
): boolean {
  return Boolean(
    query.phoneNumber ||
      query.meterNumber ||
      query.transactionId ||
      query.mpesaReceiptNumber,
  );
}
