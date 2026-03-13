# Customer Prompts E2E

This flow documents the customer reminder endpoints under `/api/customer-prompts`.

## Purpose

Give staff a safe way to preview and queue customer-facing app prompts based on:

- unresolved failed purchases
- stale purchase history that suggests a buy-token nudge

## Endpoints

- `GET /api/customer-prompts`
- `POST /api/customer-prompts/queue`

## Access

- `user`: can preview and queue prompts
- `admin`: can preview and queue prompts
- unauthenticated: denied

## Query behavior

`GET /api/customer-prompts` supports:

- `type`: `all`, `failed_purchase_follow_up`, `buy_token_nudge`
- `phoneNumber`
- `meterNumber`
- `staleDays`
- `limit`
- `offset`

## Queue behavior

`POST /api/customer-prompts/queue` supports the same filters plus:

- `maxPrompts`

The queue action:

- reuses the preview logic
- stores pending app notifications for future FCM delivery
- dedupes against recent customer app notifications
- writes an audit log for the staff action

## E2E coverage

Covered by [customer-prompts.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/customer-prompts.e2e.test.ts).

The test verifies:

- staff can list failed-purchase and buy-token prompt candidates
- queueing skips recently queued duplicate prompts
- queueing still creates the non-duplicate pending app notification
