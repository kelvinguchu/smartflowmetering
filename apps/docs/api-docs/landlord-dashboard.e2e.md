# Landlord Dashboard E2E

This flow documents the landlord dashboard data endpoints under `/api/mobile/landlord-access`.

## Purpose

Provide landlord-facing app data for:

- overall meter and financial summary
- mother-meter level balances and obligations
- sub-meter purchase activity

The API returns operational and financial data for the landlord's own mother meters and sub-meters, while excluding company commission/earnings fields.

## Endpoints

- `GET /api/mobile/landlord-access/summary`
- `GET /api/mobile/landlord-access/mother-meters`
- `GET /api/mobile/landlord-access/purchases`

## Data model

- prepaid mother meters expose estimated available balance
- postpaid mother meters expose outstanding amount still owed to utility
- company utility payments come from `mother_meter_events.bill_payment`
- utility funding loaded comes from `mother_meter_events.initial_deposit` and `mother_meter_events.refill`
- postpaid and prepaid tracking are persistent dashboard/history data, not landlord notification types
- purchase history exposes `meterCreditAmount` from transaction `netAmount`, not company commission
- purchase history exposes `completedAt` only, not redundant internal `createdAt`
- `summary`, `mother-meters`, and `purchases` support optional `propertyId` filtering for property-scoped analytics

## E2E coverage

Covered by [landlord-dashboard.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/landlord-dashboard.e2e.test.ts).

The test verifies:

- landlord summary combines prepaid and postpaid mother-meter data correctly
- landlord summary can be filtered to one property
- mother-meter details include nested sub-meter purchase activity
- mother-meter list can be filtered to one property
- purchase history can be filtered to one property
- purchase history can be filtered by sub-meter
- company commission, gross amount, and tariff snapshot are not exposed in the landlord purchase payload
