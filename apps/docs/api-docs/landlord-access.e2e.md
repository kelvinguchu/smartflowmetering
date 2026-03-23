# Landlord Access E2E

This flow documents the mobile landlord access endpoints under `/api/mobile/landlord-access`.

## Purpose

Allow registered landlords to access the mobile app using their phone number and an SMS OTP.

The landlord phone number must already exist in the approved onboarding data. The API normalizes it to `254...` before sending or verifying the OTP.

## Endpoints

- `POST /api/mobile/landlord-access/send-otp`
- `POST /api/mobile/landlord-access/verify-otp`
- `GET /api/mobile/landlord-access/me`
- `GET /api/mobile/landlord-access/notifications`
- `POST /api/mobile/landlord-access/device-tokens`
- `POST /api/mobile/landlord-access/notifications/:id/read`

## Auth model

- OTP send/verify delegates to Better Auth phone-number verification
- successful verification returns a Better Auth session token
- the mobile app should use `Authorization: Bearer <token>` on subsequent landlord routes
- landlord notifications and landlord device tokens are anchored by `landlordId`, not phone number alone

## E2E coverage

Covered by [landlord-access.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/landlord-access.e2e.test.ts).

The test verifies:

- a registered landlord can request an OTP with either `0712...` or `254712...` input
- OTP verification links the landlord customer record to a Better Auth user with role `landlord`
- the returned bearer token can access `/me`
- landlord notifications can be listed and marked read
- landlord notifications can be filtered by `propertyId` and `motherMeterId` when those ids are present in notification metadata
- landlord-scoped device tokens can be saved from the mobile route
