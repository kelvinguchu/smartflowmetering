# Landlord Notification Producer E2E

This flow documents the real landlord app-notification producers behind the mobile landlord feed.

## Purpose

Create landlord-scoped app notifications for the events a landlord actually needs to act on or track.

Current producer-backed landlord notification types:

- `landlord_daily_usage_summary`
- `landlord_mother_meter_event_recorded`
- `landlord_sub_meter_purchase`
- `landlord_prepaid_low_balance`

## Behavior

- daily usage summaries create one app notification per landlord per target date
- sub-meter purchases create a landlord app notification tied to the exact transaction reference
- low-balance alerts create landlord app notifications for prepaid mother meters only
- recorded mother-meter events create landlord app notifications immediately for `initial_deposit`, `refill`, and `bill_payment`
- notifications are deduplicated per landlord and logical reference id
- every landlord app notification record is anchored by `landlordId`
- postpaid tracking stays in landlord dashboard/history data instead of the notification feed

## E2E coverage

Covered by [landlord-notification-producer.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/landlord-notification-producer.e2e.test.ts).

The test verifies:

- a landlord daily usage summary app notification is created for a qualifying day
- a landlord sub-meter purchase notification is created and deduplicated by transaction reference
- a landlord prepaid low-balance app notification is created from the alert workflow
- a recorded mother-meter event creates a landlord app notification through the staff route
