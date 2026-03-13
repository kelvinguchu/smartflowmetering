# RBAC Permissions E2E

Source of truth for this document:
- [rbac-permissions.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/rbac-permissions.e2e.test.ts)
- [api-health-auth.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/api-health-auth.e2e.test.ts)
- [rbac.ts](/D:/smartflowmetering/apps/api/src/lib/rbac.ts)

## Purpose

This E2E work verifies that the API enforces a clear staff role split:

- `user` is a support/operator role with read and safe recovery access.
- `admin` is a privileged operational role with mutation and sensitive system access.

The permission checks are enforced centrally through:
- [auth-middleware.ts](/D:/smartflowmetering/apps/api/src/lib/auth-middleware.ts)
- [rbac.ts](/D:/smartflowmetering/apps/api/src/lib/rbac.ts)

## Verified Role Model

### `user`

Allowed:
- read applications
- read meters
- read current tariffs
- read SMS logs
- resend SMS deliveries
- read transactions
- resend transaction tokens
- read mother meters

Denied:
- approve or reject applications
- create or update meters
- suspend or activate meters
- read transaction summary stats
- create mother meter events
- read mother meter reconciliation
- access notifications operations
- access failed transaction operations
- access Gomelong operations routes
- read tariff history or manage tariffs
- access detailed system diagnostics
- access M-Pesa diagnostics
- manage mother meter alerts
- send SMS test messages
- generate admin tokens

### `admin`

Allowed:
- everything `user` can do
- approve or reject applications
- read and manage tariffs
- create or update meters
- suspend or activate meters
- access detailed system diagnostics
- access M-Pesa diagnostics
- manage mother meter alerts
- send SMS test messages
- read transaction summary stats
- create mother meter events
- read mother meter reconciliation
- access notifications operations
- access failed transaction operations
- access Gomelong operations routes
- generate admin tokens

## Route Coverage

### Applications

Routes:
- [applications.ts](/D:/smartflowmetering/apps/api/src/routes/applications.ts)

Permissions:
- `applications:read`
- `applications:decide`

Behavior:
- staff can list and view applications
- only admins can approve or reject

### Meters

Routes:
- [meters.ts](/D:/smartflowmetering/apps/api/src/routes/meters.ts)

Permissions:
- `meters:read`
- `meters:write`
- `meters:status`

Behavior:
- staff can read and look up meters
- only admins can create, update, suspend, and activate

### Transactions

Routes:
- [transactions.ts](/D:/smartflowmetering/apps/api/src/routes/transactions.ts)

Permissions:
- `transactions:read`
- `transactions:resend_token`
- `transactions:summary`

Behavior:
- staff can read transactions and resend tokens
- only admins can read summary stats

### Tariffs

Routes:
- [tariffs.ts](/D:/smartflowmetering/apps/api/src/routes/tariffs.ts)

Permissions:
- `tariffs:read`
- `tariffs:manage`

Behavior:
- staff can read the active tariff list and individual tariff details
- only admins can read full tariff history and mutate tariffs

### SMS

Routes:
- [sms.ts](/D:/smartflowmetering/apps/api/src/routes/sms.ts)

Permissions:
- `sms:read`
- `sms:resend`
- `sms:test`

Behavior:
- staff can read SMS logs and requeue safe resend flows
- only admins can trigger SMS test sends

### Mother Meters

Routes:
- [mother-meters.ts](/D:/smartflowmetering/apps/api/src/routes/mother-meters.ts)

Permissions:
- `mother_meters:read`
- `mother_meters:events:create`
- `mother_meters:reconciliation:read`

Behavior:
- staff can read mother meter lists, events, and balances
- only admins can create events and read reconciliation

### Admin Operations

Routes:
- [notifications.ts](/D:/smartflowmetering/apps/api/src/routes/notifications.ts)
- [failed-transactions.ts](/D:/smartflowmetering/apps/api/src/routes/failed-transactions.ts)
- [gomelong.ts](/D:/smartflowmetering/apps/api/src/routes/meter-providers/gomelong.ts)
- [admin-tokens.ts](/D:/smartflowmetering/apps/api/src/routes/admin-tokens.ts)

Permissions:
- `notifications:manage`
- `failed_transactions:manage`
- `provider_ops:gomelong`
- `admin_tokens:create`

Behavior:
- all of these remain admin-only

### Diagnostics And Alerts

Routes:
- [health.ts](/D:/smartflowmetering/apps/api/src/routes/health.ts)
- [validation-routes.ts](/D:/smartflowmetering/apps/api/src/routes/mpesa/validation-routes.ts)
- [mother-meter-alert-routes.ts](/D:/smartflowmetering/apps/api/src/routes/mother-meter-alert-routes.ts)

Permissions:
- `system:diagnostics:read`
- `mpesa:health:read`
- `mother_meter_alerts:manage`

Behavior:
- public health remains limited to `/api/health`
- only admins can access detailed system diagnostics, M-Pesa diagnostics, and mother meter alert operations

## What The E2E Tests Prove

The RBAC E2E coverage proves:
- support staff can access support-safe backend flows
- support staff receive `403` on admin-only operational routes
- admins receive successful responses on those same routes
- the permission map is enforced through middleware, not just route naming conventions
- tariffs, SMS, diagnostics, and mother meter alert routes follow the same permission model

## Verification Used

The RBAC slice was verified with:

```bash
bunx tsc --noEmit
npx eslint apps/api/src/lib/rbac.ts apps/api/src/lib/auth-middleware.ts apps/api/src/routes/applications.ts apps/api/src/routes/meters.ts apps/api/src/routes/transactions.ts apps/api/src/routes/mother-meters.ts apps/api/src/routes/notifications.ts apps/api/src/routes/failed-transactions.ts apps/api/src/routes/meter-providers/gomelong.ts apps/api/src/routes/admin-tokens.ts apps/api/src/services/admin-notifications.service.ts apps/api/tests/e2e/rbac-permissions.e2e.test.ts
docker run --rm --network smartflowmetering_backend -v D:\smartflowmetering:/workspace -w /workspace oven/bun:1.3.4 bun test apps/api/tests/e2e/rbac-permissions.e2e.test.ts
docker run --rm --network smartflowmetering_backend -v D:\smartflowmetering:/workspace -w /workspace oven/bun:1.3.4 bun test apps/api/tests/e2e/api-health-auth.e2e.test.ts
```

## Current Limitation

This work documents and enforces API permissions only. It does not yet add admin dashboard UI permission handling or role-aware navigation.
