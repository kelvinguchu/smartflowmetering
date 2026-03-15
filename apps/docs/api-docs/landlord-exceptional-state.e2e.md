# Landlord Exceptional State E2E

## Purpose

These endpoints expose landlord-visible exceptional operational data derived from
existing mother-meter events and tenant purchases. They are data endpoints, not
notifications.

## Endpoints

- `GET /api/mobile/landlord-access/exceptional-state/summary`
- `GET /api/mobile/landlord-access/exceptional-state/mother-meters`

## Data Sources

The API derives these states from:

- completed tenant purchases in `transactions`
- company utility funding and bill payments in `mother_meter_events`
- mother-meter type and property linkage in `mother_meters`

## Supported Exceptional Conditions

- prepaid mother meter with negative derived balance
- postpaid mother meter with large outstanding derived amount
- mother meter with stale company payment activity

## Query Controls

- `propertyId`
- `companyPaymentInactivityDays`
- `postpaidOutstandingAmountThreshold`
- `includeNominal` on the mother-meter list

## E2E Coverage

Covered by [landlord-exceptional-state.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/landlord-exceptional-state.e2e.test.ts).
