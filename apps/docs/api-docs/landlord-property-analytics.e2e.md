# Landlord Property Analytics E2E

## Purpose

Adds landlord property-level chart data endpoints:

- `GET /api/mobile/landlord-access/properties/:id/analytics-summary`
- `GET /api/mobile/landlord-access/properties/:id/rollups`
- `GET /api/mobile/landlord-access/properties/:id/mother-meter-comparisons`

These are derived from Smart Flow Metering purchase and financial-event data, not actual
meter-consumption telemetry.

## Property Analytics Summary

`/analytics-summary` returns one range summary for the selected property with:

- overall totals for purchases and company utility funding/payments
- prepaid and postpaid breakdowns
- mother-meter counts
- optional `motherMeterType=prepaid|postpaid` filter

## Property Rollups

`/rollups` supports:

- `granularity=day|week|month`
- `motherMeterType=prepaid|postpaid`
- `startDate`
- `endDate`
- `limit`
- `offset`

Each bucket includes:

- `bucket`
- `bucketMeta`
  - `key`
  - `startDate`
  - `endDate`
  - `label`
- aggregated purchase totals
- prepaid/postpaid totals breakdown
- aggregated utility funding and company bill payments
- running property-level derived financial snapshot
- shared mobile collection pagination metadata:
  - `limit`
  - `offset`
  - `hasMore`
  - `nextOffset`

## Mother Meter Comparisons

`/mother-meter-comparisons` compares mother meters within a property over a selected range,
with optional `motherMeterType=prepaid|postpaid` filtering.

Each row includes:

- mother meter identity and type
- range totals for purchases and financial events
- derived financial snapshot for that mother meter
- the shared mobile collection pagination metadata

## E2E Coverage

Covered by [landlord-property-analytics.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/landlord-property-analytics.e2e.test.ts).
