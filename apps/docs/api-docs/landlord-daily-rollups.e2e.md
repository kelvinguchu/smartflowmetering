# Landlord Daily Rollups E2E

## Purpose

These endpoints provide derived daily rollups from Smart Flow Metering purchase and financial
event data. They do not represent actual meter-consumption telemetry.

Endpoints:

- `GET /api/mobile/landlord-access/mother-meters/:id/daily-rollups`
- `GET /api/mobile/landlord-access/sub-meters/:id/daily-rollups`

## Mother Meter Daily Rollups

Returns one row per Nairobi-local day with:

- tenant purchase totals
- utility funding added
- company bill payments made
- end-of-day derived financial snapshot

The snapshot includes:

- `utilityFundingLoaded`
- `companyPaymentsToUtility`
- `netSalesCollected`
- `prepaidEstimatedBalance` for prepaid mother meters
- `postpaidOutstandingAmount` for postpaid mother meters

## Sub Meter Daily Rollups

Returns one row per Nairobi-local day with:

- purchase count
- tenant purchase net amount total
- units purchased total
- cumulative net sales
- cumulative units purchased

## E2E Coverage

Covered by [landlord-daily-rollups.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/landlord-daily-rollups.e2e.test.ts).
