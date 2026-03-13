# SMS DLR Webhook E2E

This flow documents the HostPinnacle delivery-report webhook at `POST /api/sms/webhooks/hostpinnacle/dlr` and `GET /api/sms/webhooks/hostpinnacle/dlr`.

## Purpose

Receive authenticated delivery receipts from HostPinnacle and reconcile them into `sms_logs` without polling.

## Authentication

The webhook is protected by a shared secret header.

Configure HostPinnacle custom headers with:

- header name: `x-hostpinnacle-webhook-token`
- header value: the value of `HOSTPINNACLE_DLR_WEBHOOK_TOKEN`

The header name is configurable through `HOSTPINNACLE_DLR_WEBHOOK_HEADER`.

## Recommended HostPinnacle field names

When configuring the DLR webhook, set these parameter names:

- Transaction ID Parameter: `transactionId`
- Message ID Parameter: `messageId`
- Error Code Parameter: `errorCode`
- Mobile Number Parameter: `mobileNumber`
- Received Time Parameter: `receivedTime`
- Delivered Time Parameter: `deliveredTime`

If HostPinnacle also sends a status field, use `status`.

## Behavior

The webhook handler:

- authenticates the request using the shared secret header
- matches `sms_logs` by `providerMessageId` first
- falls back to the latest HostPinnacle SMS log for the same phone number
- updates:
  - `status`
  - `provider_status`
  - `provider_error_code`
  - `provider_received_at`
  - `provider_delivered_at`

## E2E coverage

Covered by [sms-dlr-webhook.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/sms-dlr-webhook.e2e.test.ts).

The test verifies:

- authenticated JSON callbacks update the matched SMS log
- invalid webhook tokens are rejected with `403`
- GET callbacks can fall back to phone-number matching when `messageId` is absent
