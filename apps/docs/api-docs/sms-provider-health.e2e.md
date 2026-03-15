# SMS Provider Health E2E

This flow documents `GET /api/sms/provider-health`.

## Purpose

Give staff a compact backend view of:

- HostPinnacle failure rate
- TextSMS fallback usage rate
- pending TextSMS DLR sync backlog

## Access

- `user`: allowed
- `admin`: allowed
- unauthenticated: denied

## Query behavior

- `hours`: optional, `1..168`
- default window: `24`

## Response behavior

Returns:

- `overall` totals for the selected window
- `hostpinnacle` bucket:
  - `attempted`
  - `delivered`
  - `failed`
  - `pending`
  - `failureRate`
- `textsms` bucket:
  - `attempted`
  - `delivered`
  - `failed`
  - `pending`
  - `failureRate`
  - `fallbackUsageRate`
  - `pendingDlrSync`

## E2E coverage

Covered by [sms-provider-health.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/sms-provider-health.e2e.test.ts).
