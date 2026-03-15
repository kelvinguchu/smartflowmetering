# Landlord Timeline E2E

## Purpose

`GET /api/mobile/landlord-access/timeline` gives landlords a day-by-day tracking feed for
mother-meter financial activity. This is not a notification surface. It is the persistent
history view landlords use to track:

- tenant token purchases
- initial utility funding
- utility refills
- company bill payments to the utility

Each row also includes the running financial context for the affected mother meter at that
point in time.

## Auth

- Requires landlord mobile bearer auth from `/api/mobile/landlord-access/verify-otp`

## Query Parameters

- `propertyId`
- `motherMeterId`
- `startDate`
- `endDate`
- `limit`
- `offset`

Dates use `YYYY-MM-DD`.

## Response Shape

Returns:

- `count`
- `data`

Each item in `data` includes:

- `type`
  - `tenant_purchase`
  - `initial_deposit`
  - `refill`
  - `bill_payment`
- `occurredAt`
- `amount`
- `motherMeter`
- optional `meter`
- optional `transaction`
- `financialSnapshot`

## Financial Snapshot Semantics

`financialSnapshot` is scoped to the affected mother meter and represents the running state as
of that row:

- `utilityFundingLoaded`
- `companyPaymentsToUtility`
- `netSalesCollected`
- `prepaidEstimatedBalance`
- `postpaidOutstandingAmount`

Rules:

- prepaid mother meters expose `prepaidEstimatedBalance`
- postpaid mother meters expose `postpaidOutstandingAmount`
- the other field is `null`

## E2E Coverage

Covered by [landlord-timeline.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/landlord-timeline.e2e.test.ts).

The E2E verifies:

- mixed timeline rows from purchases and mother-meter events
- running prepaid snapshot calculations
- running postpaid snapshot calculations
- property-level filtering
