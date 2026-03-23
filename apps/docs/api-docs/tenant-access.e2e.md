# Tenant Access E2E

This flow documents the tenant mobile-access bootstrap under `/api/mobile/tenant-access`.

## Purpose

Provide tenant app access without treating the tenant as the owner of the sub-meter.

The tenant enters a sub-meter serial number, receives a tenant access token, and uses that token for tenant-scoped mobile actions.

Current tenant notification catalog:

- `buy_token_nudge`
- `failed_purchase_follow_up`
- `token_purchase_recorded`
- `token_delivery_available`
- `meter_status_alert`

## Endpoints

- `POST /api/mobile/tenant-access/bootstrap`
- `GET /api/mobile/tenant-access/me`
- `GET /api/mobile/tenant-access/notifications`
- `POST /api/mobile/tenant-access/device-tokens`
- `POST /api/mobile/tenant-access/notifications/:id/read`

## Access model

- tenant onboarding is access-based, not ownership-based
- the access token is created only for an active sub-meter
- tenant device tokens are attached to `tenant_app_accesses`, not to a landlord/customer account
- tenant notification read ACKs are scoped to the tenant access token that owns the notification
- tenant notification listing supports bounded pagination plus optional `status` and `type` filters
- tenant summary and purchase history are documented in [tenant-dashboard.e2e.md](/D:/smartflowmetering/apps/docs/api-docs/tenant-dashboard.e2e.md)
- tenant token delivery history is documented in [tenant-token-deliveries.e2e.md](/D:/smartflowmetering/apps/docs/api-docs/tenant-token-deliveries.e2e.md)
- tenant collection endpoints return `pagination` metadata with `limit`, `offset`, `hasMore`, and `nextOffset`

## E2E coverage

Covered by [tenant-access.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/tenant-access.e2e.test.ts).

The test verifies:

- bootstrap succeeds for an active sub-meter serial
- a tenant access token can load its own meter context
- a tenant access token can list only its own notifications
- a tenant access token can register an FCM device token
- a tenant access token can mark its own app notification as read
