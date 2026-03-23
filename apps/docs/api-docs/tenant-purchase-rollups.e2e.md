# Tenant Purchase Rollups E2E

## Purpose

`GET /api/mobile/tenant-access/purchase-rollups` returns derived daily purchase rollups for the
authenticated tenant-access meter. This is purchase history, not actual meter-consumption usage.

It supports:

- `granularity=day|week|month`
- `startDate`
- `endDate`
- `limit`
- `offset`

## Response

Each bucket includes:

- `bucket`
- `bucketMeta`
  - `key`
  - `startDate`
  - `endDate`
  - `label`
- `purchaseCount`
- `meterCreditAmount`
- `unitsPurchased`
- `cumulativeMeterCreditAmount`
- `cumulativeUnitsPurchased`

## E2E Coverage

Covered in [tenant-access.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/tenant-access.e2e.test.ts).
