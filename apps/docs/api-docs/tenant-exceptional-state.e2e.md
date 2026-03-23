# Tenant Exceptional State E2E

## Purpose

- Verify the tenant mobile API exposes backend-only exceptional state data for the authenticated sub-meter.
- Keep these states as data, not notifications.

## Endpoint

- `GET /api/mobile/tenant-access/exceptional-state`

## Auth

- Requires a valid tenant bearer token from `POST /api/mobile/tenant-access/bootstrap`.

## Response Shape

- `meter`
  - current sub-meter identity and status
- `thresholds`
  - `pendingTokenMinutes`
  - `unacknowledgedTokenMinutes`
- `summary`
  - `count`
  - `criticalCount`
  - `warningCount`
- `data`
  - array of exceptional-state items

## Supported Exceptional States

- `meter_inactive`
- `meter_suspended`
- `token_pending_generation`
- `token_available_unacknowledged`

## Notes

- `token_pending_generation` is emitted only for completed purchases without a generated credit token that are older than the pending-token threshold.
- `token_available_unacknowledged` is emitted only for completed purchases with a generated credit token older than the unacknowledged-token threshold where the tenant has not acknowledged the token-delivery notification.
- The endpoint does not expose company commission or internal-only financial fields.
