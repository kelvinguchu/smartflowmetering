# SMS Recovery E2E

This flow documents the failed-SMS recovery endpoints under `/api/sms/recovery`.

## Purpose

Give staff a focused recovery surface for SMS delivery issues using webhook-backed provider truth.

## Endpoints

- `GET /api/sms/recovery`
- `POST /api/sms/recovery/:id/retry`
- `POST /api/sms/recovery/retry-batch`

## Access

- `user`: can read recovery entries and queue retries
- `admin`: can read recovery entries and queue retries
- unauthenticated: denied

## Query behavior

`GET /api/sms/recovery` supports:

- `deliveryState`: `failed`, `pending`, `delivered`, `all`
- `phoneNumber`
- `meterNumber`
- `transactionId`
- `q`
- `limit`
- `offset`

## Response behavior

The recovery list returns:

- filtered SMS recovery items
- transaction and meter context when available
- provider failure metadata:
  - `providerStatus`
  - `providerErrorCode`
  - `providerMessageId`
- retry eligibility
- summary counts for `failed`, `pending`, `delivered`, and `total`

## E2E coverage

Covered by [sms-recovery.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/sms-recovery.e2e.test.ts).

The test verifies:

- support staff can list failed SMS recovery entries with transaction context
- single retries can be queued
- batch retries can be queued
