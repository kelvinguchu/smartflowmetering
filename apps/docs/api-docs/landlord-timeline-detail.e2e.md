# Landlord Timeline Detail E2E

## Purpose

Adds drill-down timeline endpoints for landlord tracking:

- `GET /api/mobile/landlord-access/mother-meters/:id/timeline`
- `GET /api/mobile/landlord-access/sub-meters/:id/timeline`

These endpoints are for persistent financial tracking, not notifications.

## Mother Meter Timeline

Returns the same landlord timeline row model, but scoped to one mother meter.

Supported query parameters:

- `startDate`
- `endDate`
- `limit`
- `offset`

## Sub Meter Timeline

Returns completed purchase rows for one sub meter with cumulative totals:

- `meterCreditAmount`
- `unitsPurchased`
- `cumulativeNetSales`
- `cumulativeUnitsPurchased`
- `mpesaReceiptNumber`
- `phoneNumber`
- `transactionId`
- `occurredAt`

Supported query parameters:

- `startDate`
- `endDate`
- `limit`
- `offset`

## E2E Coverage

Covered by [landlord-timeline-detail.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/landlord-timeline-detail.e2e.test.ts).

The E2E verifies:

- mother-meter timeline drill-down stays scoped to one mother meter
- sub-meter timeline drill-down returns cumulative purchase tracking
