# App Notification Processor E2E

This flow documents the queue-backed FCM delivery processor for customer app notifications.

## Purpose

Validate that queued notification delivery behaves predictably under success, partial token failure, and retry exhaustion.

## Worker behavior

- loads the pending `customer_app_notifications` record
- looks up active `customer_device_tokens` for `tenantAccessId`, then `landlordId`, then phone number fallback
- sends a multicast FCM message through Firebase Admin
- invalidates permanently bad device tokens
- marks the notification `sent` when at least one device succeeds
- records retry metadata on retryable failures
- marks the notification `failed` when the final retryable attempt is exhausted or when no valid devices remain

## E2E coverage

Covered by [app-notification.processor.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/app-notification.processor.e2e.test.ts).

The test verifies:

- successful FCM delivery marks the notification `sent`
- landlord-scoped notifications deliver through landlord device tokens
- invalid device tokens are deactivated without losing successful deliveries on other devices
- a final retryable delivery error marks the notification `failed` and persists failure metadata
