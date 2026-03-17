import { HTTPException } from "hono/http-exception";
import type { AuthUser } from "./auth-middleware";

interface TransactionSearchQuery {
  meterNumber?: string;
  mpesaReceiptNumber?: string;
  phoneNumber?: string;
  transactionId?: string;
}

interface CustomerLookupQuery {
  landlordId?: string;
  meterNumber?: string;
  phoneNumber?: string;
}

interface SupportRecoveryLookupQuery {
  meterNumber?: string;
  mpesaReceiptNumber?: string;
  phoneNumber?: string;
  q?: string;
  transactionId?: string;
}

interface SmsRecoveryLookupQuery {
  meterNumber?: string;
  phoneNumber?: string;
  transactionId?: string;
}

interface SmsRecoveryScopeTarget {
  meterNumber: string | null;
  phoneNumber: string | null;
  transactionId: string | null;
}

export function isAdminStaffUser(user: AuthUser): boolean {
  return user.role === "admin";
}

export function ensureAdminRouteAccess(user: AuthUser, action: string): void {
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

export function ensureSupportPendingQueueAccess(
  user: AuthUser,
  status: string | undefined,
  options: {
    pendingStatus: string;
    workflow: string;
  },
): void {
  if (isAdminStaffUser(user)) {
    return;
  }

  if (!status || status === options.pendingStatus) {
    return;
  }

  throw new HTTPException(403, {
    message: `Forbidden: Support staff can only broad-list ${options.workflow} in ${options.pendingStatus} status`,
  });
}

export function ensureSupportScopedCustomerLookup(
  user: AuthUser,
  query: CustomerLookupQuery,
  workflow: string,
): void {
  if (isAdminStaffUser(user)) {
    return;
  }

  if (query.phoneNumber || query.meterNumber || query.landlordId) {
    return;
  }

  throw new HTTPException(403, {
    message: `Forbidden: Support staff must scope ${workflow} by phone number, meter number, or landlord`,
  });
}

export function ensureSupportScopedRecoveryLookup(
  user: AuthUser,
  query: SupportRecoveryLookupQuery,
  workflow: string,
): void {
  if (isAdminStaffUser(user)) {
    return;
  }

  if (
    query.phoneNumber ||
    query.meterNumber ||
    query.transactionId ||
    query.mpesaReceiptNumber
  ) {
    return;
  }

  throw new HTTPException(403, {
    message: `Forbidden: Support staff must scope ${workflow} by phone number, meter number, transaction reference, or M-Pesa receipt`,
  });
}

export function ensureSupportScopedSmsRecoveryLookup(
  user: AuthUser,
  query: SmsRecoveryLookupQuery,
  workflow: string,
): void {
  if (isAdminStaffUser(user)) {
    return;
  }

  if (query.phoneNumber || query.meterNumber || query.transactionId) {
    return;
  }

  throw new HTTPException(403, {
    message: `Forbidden: Support staff must scope ${workflow} by phone number, meter number, or transaction reference`,
  });
}

export function matchesSmsRecoveryScope(
  target: SmsRecoveryScopeTarget,
  query: SmsRecoveryLookupQuery,
): boolean {
  if (query.phoneNumber && target.phoneNumber !== query.phoneNumber) {
    return false;
  }

  if (query.meterNumber && target.meterNumber !== query.meterNumber) {
    return false;
  }

  if (query.transactionId && target.transactionId !== query.transactionId) {
    return false;
  }

  return Boolean(query.phoneNumber || query.meterNumber || query.transactionId);
}
