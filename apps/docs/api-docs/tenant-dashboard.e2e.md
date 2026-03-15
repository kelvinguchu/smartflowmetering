# Tenant Dashboard E2E

## Purpose

Document the tenant mobile read-model endpoints that summarize purchase history for the authenticated sub-meter.

## Endpoints

- `GET /api/mobile/tenant-access/summary`
- `GET /api/mobile/tenant-access/purchases`
- `GET /api/mobile/tenant-access/purchase-rollups`

## Data shape

`GET /summary` returns:

- authenticated sub-meter identity and current status
- owning mother-meter reference
- property reference
- total completed purchases
- total meter-credit amount
- total units purchased

`GET /purchases` returns completed purchases for the authenticated sub-meter only.

`GET /purchase-rollups` returns derived purchase buckets from Smart Flow Metering transaction data, not actual meter-consumption telemetry.

Tenant collection endpoints use the shared mobile collection contract:

- `count`
- `data`
- `pagination`
  - `limit`
  - `offset`
  - `hasMore`
  - `nextOffset`

## E2E Coverage

Covered by [tenant-dashboard.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/tenant-dashboard.e2e.test.ts).
