# Support Recovery E2E

This flow documents the staff support recovery endpoint at `GET /api/support-recovery`.

## Purpose

Give staff one read-only support surface that can:

- search by `phoneNumber`
- search by `meterNumber`
- search by `transactionId`
- search by `mpesaReceiptNumber`
- search by generic `q`

The endpoint returns the matched meter context, recent transactions, recent SMS delivery context, and recent admin-token history for the matched meter.

## Access

- `user`: allowed
- `admin`: allowed
- unauthenticated: denied

RBAC is enforced by `support_recovery:read`.

## E2E coverage

Covered by [support-recovery.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/support-recovery.e2e.test.ts).

The test verifies:

- support staff can search by phone number and see:
  - the matched meter
  - the matched transaction
  - masked token details
  - redacted SMS content
- admins can search by meter number and see recent non-credit admin token history
- anonymous callers are rejected

## Response shape

The endpoint returns:

- `search`: normalized search criteria
- `meter`: matched meter summary when available
- `transactions`: recent matched transactions with:
  - meter summary
  - masked generated tokens
  - redacted SMS logs
- `recentSmsLogs`: recent SMS log context for the matched phone number(s)
- `recentAdminTokens`: recent non-credit admin token history for the matched meter

## Security notes

- generated tokens are masked before response
- SMS bodies are redacted before response
- the endpoint is read-only
- diagnostic/system data is not exposed here
