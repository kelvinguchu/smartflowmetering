# Tenant History E2E

## Purpose

Extend the tenant mobile backend with deeper history and clearer post-payment
recovery state, without exposing internal-only transaction fields.

## Endpoints

- `GET /api/mobile/tenant-access/history-summary`
- `GET /api/mobile/tenant-access/recovery-states`

## History Summary

Returns tenant-scoped range aggregates for the authenticated sub-meter:

- total completed purchases
- total meter credit amount
- total units purchased
- first and last completed purchase timestamps
- completed payment-method breakdown
- overall transaction status breakdown for the selected period

## Recovery States

Returns a recent tenant-safe feed that combines:

- payment status
- token generation presence
- token acknowledgement state

Possible `recoveryState` values:

- `payment_pending`
- `payment_processing`
- `payment_failed`
- `token_pending_generation`
- `token_available`
- `token_acknowledged`

Both tenant history endpoints use the shared mobile collection contract where list responses include:

- `count`
- `data`
- `pagination`
  - `limit`
  - `offset`
  - `hasMore`
  - `nextOffset`

## E2E Coverage

Covered by [tenant-history.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/tenant-history.e2e.test.ts).
