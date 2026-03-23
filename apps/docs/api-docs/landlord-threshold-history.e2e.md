# Landlord Threshold History E2E

## Purpose

`GET /api/mobile/landlord-access/thresholds/mother-meters/:id/history` returns daily threshold
history for a specific mother meter.

This is backend data, not a notification feed.

## Supported Query Parameters

- `startDate`
- `endDate`
- `daysAfterLastPayment`

## Response

Each day includes:

- `date`
- `motherMeter`
- prepaid threshold state when the mother meter is prepaid
- postpaid reminder/outstanding state when the mother meter is postpaid

For prepaid history:

- `estimatedBalance`
- `lowBalanceThreshold`
- `isBelowThreshold`

For postpaid history:

- `lastBillPaymentAt`
- `daysSinceLastPayment`
- `reminderDate`
- `isReminderDue`
- `outstandingAmount`

## E2E Coverage

Covered by [landlord-threshold-history.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/landlord-threshold-history.e2e.test.ts).
