# App Notifications E2E

This flow documents the staff-facing app notification endpoints under `/api/app-notifications`.

## Purpose

Provide the backend surfaces needed to support FCM delivery:

- customer device token management
- landlord-scoped device token management
- listing queued customer app notifications
- requeueing delivery for pending or failed notifications with queue deduplication

## Endpoints

- `GET /api/app-notifications`
- `POST /api/app-notifications/:id/requeue`
- `GET /api/app-notifications/device-tokens`
- `POST /api/app-notifications/device-tokens`
- `DELETE /api/app-notifications/device-tokens/:id`

## Access

- `user`: allowed
- `admin`: allowed
- unauthenticated: denied

## E2E coverage

Covered by [app-notifications.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/app-notifications.e2e.test.ts).

The test verifies:

- staff can save a customer device token
- staff can save and list a landlord-scoped device token by `landlordId`
- staff can list customer device tokens
- staff can deactivate a customer device token
- staff can requeue an app notification without creating duplicate queued jobs

## Delivery state

Each app notification now tracks:

- `deliveryAttempts`
- `lastAttemptAt`
- `lastFailureCode`
- `lastFailureMessage`

Requeue rules:

- `pending` and `failed` notifications can be queued
- `sent` and `read` notifications return `409`
- repeated queue requests while a job is already waiting or active return the existing job id
