# Tenant Notification Producer E2E

This flow documents the first real tenant app-notification producers.

## Purpose

Create tenant-scoped app notifications automatically from transaction lifecycle events, instead of relying only on preview-style prompt records.

Current producer-backed tenant notification types:

- `meter_status_alert`
- `token_purchase_recorded`
- `token_delivery_available`

## Behavior

- active tenant accesses for a sub-meter receive tenant-scoped app notifications
- notifications are deduplicated by `tenantAccessId + type + referenceId`
- created notifications are queued for FCM delivery through the existing app-notification queue

## E2E coverage

Covered by [tenant-notification-producer.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/tenant-notification-producer.e2e.test.ts).

The test verifies:

- a token purchase recorded notification is created for an active tenant access
- a meter status alert is created when staff suspend a meter
- the same tenant notification is not duplicated for the same `type` and `referenceId`
