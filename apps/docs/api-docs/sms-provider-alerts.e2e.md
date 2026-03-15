# SMS Provider Alerts E2E

This flow documents `POST /api/notifications/run-sms-provider-alerts`.

## Purpose

Generate admin notifications when SMS provider health crosses alert thresholds.

## Access

- `admin`: allowed
- `user`: denied
- unauthenticated: denied

## Request behavior

The request can set:

- `windowHours`
- `dedupeWindowHours`
- `minFailedCount`
- `hostpinnacleFailureRatePercent`
- `textsmsFallbackUsageRatePercent`
- `textsmsPendingDlrThreshold`

## Alert behavior

Creates `sms_provider_outage` admin notifications for:

- HostPinnacle failure spikes
- TextSMS fallback usage spikes
- TextSMS pending DLR backlog spikes

## E2E coverage

Covered by [sms-provider-alerts.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/sms-provider-alerts.e2e.test.ts).
