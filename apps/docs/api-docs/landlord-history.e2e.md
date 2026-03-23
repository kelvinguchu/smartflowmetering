# Landlord History E2E

This flow documents the landlord mobile history/detail endpoints under `/api/mobile/landlord-access`.

## Purpose

Give authenticated landlords deeper operational visibility without exposing company earnings.

These endpoints let the app show:

- detailed mother-meter financial state
- a single landlord activity ledger across utility events and tenant purchases
- recent utility funding and payment events
- recent token purchases per mother meter
- daily usage history grouped by mother meter and sub meter

## Endpoints

- `GET /api/mobile/landlord-access/mother-meters/:id`
- `GET /api/mobile/landlord-access/sub-meters/:id`
- `GET /api/mobile/landlord-access/activity`
- `GET /api/mobile/landlord-access/usage-history`

## Data shape

`GET /mother-meters/:id` returns:

- mother meter identity and property details
- prepaid estimated balance or postpaid outstanding amount
- utility funding loaded
- company payments to utility
- recent utility events
- recent completed purchases
- sub-meter totals and purchase activity

`GET /sub-meters/:id` returns:

- the sub-meter identity and current status
- the owning mother-meter reference
- total completed purchases for that sub-meter
- total units purchased and total landlord-credit value from completed purchases
- recent completed purchases for that sub-meter only

`GET /activity` returns a reverse-chronological landlord ledger combining:

- mother-meter utility events: `initial_deposit`, `refill`, `bill_payment`
- tenant completed purchases as `tenant_purchase`

The purchase entries expose landlord-safe values only: `amount` is transaction `netAmount`, not gross payment and not company commission.

`GET /activity` and `GET /usage-history` also support optional `propertyId` filtering for property-scoped landlord views.

`GET /usage-history` returns landlord-scoped completed purchase history grouped by Nairobi calendar date and mother meter, with nested sub-meter totals.

The history response exposes `meterCreditAmountTotal` from transaction `netAmount`, not gross payment and not company commission.

List-style landlord history endpoints use the shared mobile collection contract:

- `count`
- `data`
- `pagination`
  - `limit`
  - `offset`
  - `hasMore`
  - `nextOffset`

## E2E coverage

Covered by [landlord-history.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/landlord-history.e2e.test.ts).

The test verifies:

- a landlord can fetch a mother-meter detail view for an owned mother meter
- a landlord can fetch a sub-meter drill-down view for an owned sub-meter
- a landlord can fetch a combined activity ledger for an owned mother meter
- activity can be filtered to one property
- the detail response includes utility events, purchase history, and landlord-safe financial totals
- a landlord can fetch date-grouped usage history
- usage history can be filtered to one property
- usage history is correctly scoped to the requested mother meter
