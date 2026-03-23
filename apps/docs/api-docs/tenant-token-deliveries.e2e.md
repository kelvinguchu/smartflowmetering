# Tenant Token Deliveries E2E

This flow documents tenant token-delivery visibility under `/api/mobile/tenant-access/token-deliveries`.

## Purpose

Give a tenant app user a safe purchase-to-token drill-down for the authenticated sub-meter only.

The API exposes:

- completed purchase reference
- whether the STS token is available yet
- masked token only, never the full token
- latest SMS delivery state when an SMS log exists
- shared mobile collection pagination metadata on the list endpoint

## Endpoints

- `GET /api/mobile/tenant-access/token-deliveries`
- `GET /api/mobile/tenant-access/token-deliveries/:transactionId`
- `POST /api/mobile/tenant-access/token-deliveries/:transactionId/acknowledge`

## Access model

- the tenant access token scopes all results to the authenticated sub-meter
- only completed purchases for that meter are considered
- full token material is never returned
- SMS delivery state is returned from the latest SMS log tied to that transaction

## E2E coverage

Covered by [tenant-token-deliveries.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/tenant-token-deliveries.e2e.test.ts).

The test verifies:

- a tenant can fetch a token-delivery list for its own completed purchases
- a tenant can fetch a token-delivery detail entry for its own completed purchase
- token status is exposed as `token_available` or `pending_token`
- only a masked token is returned
- latest SMS delivery state is included when present
- a tenant can explicitly acknowledge a token-delivery notification by transaction reference
