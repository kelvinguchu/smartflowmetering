# Landlord Thresholds E2E

## Purpose

These endpoints expose threshold and exceptional-state data for landlords as dashboard data,
not notifications.

Endpoints:

- `GET /api/mobile/landlord-access/thresholds/summary`
- `GET /api/mobile/landlord-access/thresholds/mother-meters`

## Summary

Returns landlord-visible counts for the selected property or for all landlord properties:

- prepaid mother meters below threshold
- prepaid mother meters above threshold
- postpaid mother meters with reminder due
- postpaid mother meters not yet due

## Mother Meter States

Returns one row per matching mother meter with:

- mother meter identity
- prepaid threshold state when applicable
- postpaid reminder state when applicable

It supports:

- `propertyId`
- `daysAfterLastPayment`
- `includeNominal`

## E2E Coverage

Covered by [landlord-thresholds.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/landlord-thresholds.e2e.test.ts).
