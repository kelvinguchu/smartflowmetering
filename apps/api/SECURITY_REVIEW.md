# API Security And Performance Review

Review date: 2026-03-11

Status: Not approved yet

Scope:
- Static review of `apps/api/src`
- No dynamic testing yet
- No load testing yet
- Includes remediation progress from the first hardening pass in the current working tree

Reference sources:
- OWASP Top 10 2025: https://owasp.org/Top10/2025/
- `aboutapp.md`

Confirmed product assumption:
- `aboutapp.md:385` states the web frontend is strictly for Smart Flow Metering staff and is not a portal for landlords or tenants.
- `aboutapp.md:125-126` states customers do not need app or web access.
- Therefore, normal users must not have access to broad operational API data.

## Remediation Progress

Implemented in the current working tree:
- `requireAuth` now enforces staff-only access (`admin` or `user`) instead of accepting any authenticated account.
- `/api/auth/*` now uses `authRateLimit` in addition to the global limiter.
- Public self-service email/password sign-up is disabled outside automated tests.
- `/api/health/detailed`, `/api/health/queues`, and `/api/mpesa/health` are now admin-only.
- SMS log inspection and token resend routes now match the documented support-staff role instead of requiring admin.
- The admin transaction summary now uses a single aggregate query instead of loading the full transactions table into memory.
- The default M-Pesa callback token transport now fails closed to `header` unless another mode is explicitly configured.
- STK callback logging no longer writes the full raw callback payload to application logs.
- Rate limiting is now Redis-backed by default, with a short in-memory fallback window if Redis is temporarily unavailable.
- Payment calculations now use fixed-precision arithmetic instead of native floating-point math.
- Transaction and SMS-log API responses now redact token material instead of returning raw 20-digit tokens to clients.
- Queue workers and alert automation now start only in explicit `worker`/`all` process roles instead of every API process by default.
- Generated STS tokens are now encrypted at rest, with backward-compatible reads for legacy plaintext rows.
- Token-delivery SMS logs now store redacted token bodies at rest, while resend flows reconstruct the plaintext message server-side from the protected token record.
- The last remaining direct manufacturer token fetch now uses the shared outbound request timeout helper.
- M-Pesa raw payload blobs are now sanitized before persistence so duplicate phone/name data is not stored verbatim in JSON callback logs.
- Runtime request/worker/payment logs now redact query strings, phone numbers, meter numbers, transaction references, and STS tokens instead of printing them verbatim.
- Sensitive outbound provider calls now use a hardened fetch wrapper that disables caching, suppresses referrers, and rejects redirects.
- Admin token operations now have a dedicated workflow surface with admin-only access, audit logging, protected token storage, and optional SMS delivery instead of requiring direct raw provider usage.

Still open:
- Transaction, meter, and mother-meter object-level authorization is not fully fixed yet.
- Provider credential transport and some data-surface minimization work remain open.

## Findings

### 1. High - Broken object-level authorization on transactions

OWASP mapping:
- A01:2025 Broken Access Control

Why this is a problem:
- Any authenticated user can query transactions by arbitrary meter ID, meter number, phone number, UUID, or transaction reference.
- These responses include generated token values and related payment/SMS records.
- There is no ownership or tenant scoping before data is returned.

Evidence:
- `apps/api/src/routes/transactions.ts:28`
- `apps/api/src/routes/transactions.ts:84`
- `apps/api/src/routes/transactions.ts:114`
- `apps/api/src/routes/transactions.ts:140`

Impact:
- Unauthorized access to payment history, token values, phone numbers, and operational records.

### 2. High - Broken access control on meters and mother meters

OWASP mapping:
- A01:2025 Broken Access Control

Why this is a problem:
- Any authenticated user can list all meters.
- Any authenticated user can read meter details including landlord/property relations.
- Any authenticated user can create and update meters.
- Any authenticated user can list mother meters, event histories, and balances.

Evidence:
- `apps/api/src/routes/meters.ts:28`
- `apps/api/src/routes/meters.ts:61`
- `apps/api/src/routes/meters.ts:121`
- `apps/api/src/routes/meters.ts:170`
- `apps/api/src/routes/mother-meters.ts:28`
- `apps/api/src/routes/mother-meters.ts:55`
- `apps/api/src/routes/mother-meters.ts:121`

Impact:
- Exposure of staff-only infrastructure data.
- Non-admin mutation of core operational entities.

### 3. Medium - Auth-specific throttling exists but is not used

OWASP mapping:
- A07:2025 Authentication Failures

Why this is a problem:
- `authRateLimit` is defined, but `/api/auth/*` is only behind the global rate limiter.
- That leaves auth endpoints with weaker brute-force protection than intended.

Evidence:
- `apps/api/src/lib/rate-limit.ts:84`
- `apps/api/src/app.ts:60`
- `apps/api/src/app.ts:62`

Impact:
- Higher exposure to credential stuffing and password brute-force attempts.

### 4. Medium - M-Pesa callback token can travel in the query string

OWASP mapping:
- A05:2025 Security Misconfiguration

Why this is a problem:
- Callback auth accepts a token from query parameters.
- Default transport falls back to `query_or_header` when unset.
- Query-string secrets are more likely to leak through logs, reverse proxies, traces, and shared URLs.

Evidence:
- `apps/api/src/routes/mpesa/shared.ts:52`
- `apps/api/src/routes/mpesa/shared.ts:63`
- `apps/api/src/config/env.ts:22`
- `apps/api/src/config/env.ts:206`

Impact:
- Shared callback secret can be disclosed outside the application boundary.

### 5. Medium - Full STK callback payload is logged verbatim

OWASP mapping:
- A09:2025 Security Logging and Monitoring Failures

Why this is a problem:
- The callback body is logged with full pretty-printed JSON.
- Payment callbacks can contain phone-linked transaction details and other sensitive operational metadata.

Evidence:
- `apps/api/src/routes/mpesa/stk-routes.ts:128`

Impact:
- Sensitive data can end up in log sinks and observability systems unnecessarily.

### 6. Medium - Admin summary route loads the full transactions table into memory

Area:
- Performance / scalability

Why this is a problem:
- The route fetches every transaction row and aggregates in application code.
- This will degrade as transaction volume grows and can become an avoidable hot path.

Evidence:
- `apps/api/src/routes/transactions.ts:217`

Impact:
- Slow admin requests, increased memory pressure, and higher database/application cost.

### 7. Medium - Rate limiting is process-local only

Area:
- Security / availability / reliability

Why this is a problem:
- The limiter uses an in-memory `Map`.
- Limits reset on restart and do not coordinate across multiple instances.
- This is weak for horizontally scaled or bursty deployments.

Evidence:
- `apps/api/src/lib/rate-limit.ts:16`
- `apps/api/src/lib/rate-limit.ts:37`
- `apps/api/src/lib/rate-limit.ts:122`

Impact:
- Abuse protection can be bypassed in multi-instance deployments.

### 8. High - Self-service account registration is still enabled

OWASP mapping:
- A01:2025 Broken Access Control
- A07:2025 Authentication Failures

Why this is a problem:
- The product requirement says the web frontend is staff-only.
- The auth config enables email/password auth but does not disable public sign-up.
- The E2E helpers explicitly create accounts through `/api/auth/sign-up/email` and expect it to succeed.

Evidence:
- `apps/api/src/lib/auth.ts:28`
- `apps/api/src/lib/auth.ts:34`
- `apps/api/tests/e2e/helpers.ts:221`

Impact:
- Anyone who can reach the auth endpoints may be able to create an account in an internal staff system.

### 9. Medium - Detailed health and queue health are publicly exposed

OWASP mapping:
- A05:2025 Security Misconfiguration

Why this is a problem:
- `/api/health/detailed` exposes database and queue liveness, latency, and queue details without authentication.
- `/api/health/queues` exposes queue backlog information without authentication.
- On failure, both endpoints return raw error messages.

Evidence:
- `apps/api/src/routes/health.ts:21`
- `apps/api/src/routes/health.ts:43`
- `apps/api/src/routes/health.ts:65`

Impact:
- Operational metadata is exposed publicly.
- Attackers gain visibility into backend state and can use it for reconnaissance.

### 10. Medium - Gomelong credentials are sent in URL query parameters on multiple endpoints

OWASP mapping:
- A02:2025 Cryptographic Failures
- A05:2025 Security Misconfiguration

Why this is a problem:
- Multiple Gomelong operations call `gomelongGet(...)` with `UserId` and `Password` in the query string.
- Query-string credentials are commonly logged by proxies, upstream servers, and tracing systems.

Evidence:
- `apps/api/src/services/meter-providers/gomelong.service.ts:36`
- `apps/api/src/services/meter-providers/gomelong.service.ts:49`
- `apps/api/src/services/meter-providers/gomelong.service.ts:61`
- `apps/api/src/services/meter-providers/gomelong.service.ts:73`
- `apps/api/src/services/meter-providers/gomelong.service.ts:85`
- `apps/api/src/services/meter-providers/gomelong.service.ts:96`
- `apps/api/src/services/meter-providers/gomelong.service.ts:209`
- `apps/api/src/services/meter-providers/gomelong-client.ts:90`

Impact:
- Provider credentials can leak outside the app boundary through URL logging.

### 11. Medium - External provider calls have no explicit timeout or cancellation

Area:
- Performance / reliability

Why this is a problem:
- M-Pesa OAuth, STK initiation, STK query, Gomelong calls, and SMS delivery all rely on plain `fetch(...)` with no timeout.
- A slow provider can pin request handlers or workers longer than intended.

Evidence:
- `apps/api/src/services/mpesa/auth.ts:16`
- `apps/api/src/services/mpesa/stk.ts:44`
- `apps/api/src/services/mpesa/stk.ts:103`
- `apps/api/src/services/meter-providers/gomelong-client.ts:97`
- `apps/api/src/services/sms.service.ts:102`

Impact:
- Longer tail latency, stuck workers, and reduced resilience during provider degradation.

### 12. Medium - Public M-Pesa health endpoint exposes payment configuration metadata

OWASP mapping:
- A05:2025 Security Misconfiguration

Why this is a problem:
- `/api/mpesa/health` is public and returns the configured shortcode and environment.
- This is not highly sensitive on its own, but it is unnecessary reconnaissance data for a payment integration.

Evidence:
- `apps/api/src/routes/mpesa/validation-routes.ts:113`

Impact:
- Attackers gain extra visibility into payment environment and integration state.

### 13. Medium - Every API process starts workers and alert automation

Area:
- Performance / reliability / operations

Why this is a problem:
- Importing the queue module creates BullMQ workers immediately.
- The main API entrypoint also starts the alert automation scheduler on boot.
- In multi-instance deployments, every API replica becomes a worker host and scheduler host unless the process model is split intentionally.

Evidence:
- `apps/api/src/queues/index.ts:27`
- `apps/api/src/queues/index.ts:33`
- `apps/api/src/queues/index.ts:39`
- `apps/api/src/index.ts:14`
- `apps/api/src/services/alert-automation.service.ts:8`

Impact:
- Duplicate scheduled work, harder capacity planning, and unpredictable job-processing topology.

### 14. Medium - Mother-meter analytics paths use N+1 query patterns

Area:
- Performance / scalability

Why this is a problem:
- Low-balance alert listing loads a page of mother meters and then computes balances one meter at a time.
- Postpaid reminder listing loads a page of mother meters and then queries the latest bill payment one meter at a time.
- This grows linearly in database round trips with the number of meters processed.

Evidence:
- `apps/api/src/services/mother-meter-analytics.service.ts:141`
- `apps/api/src/services/mother-meter-analytics.service.ts:163`
- `apps/api/src/services/mother-meter-analytics.service.ts:194`
- `apps/api/src/services/mother-meter-analytics.service.ts:215`

Impact:
- Slower admin alert views and more database load as landlord/meter counts grow.

### 15. Medium - Payment math uses floating-point arithmetic in a financial path

Area:
- Financial correctness

Why this is a problem:
- The money utility claims to use string-based arithmetic to avoid floating-point errors.
- The implementation actually uses `Number.parseFloat(...)` and native floating-point multiplication/division throughout.
- Over time, this can introduce rounding drift in commission, net amount, and unit calculations.

Evidence:
- `apps/api/src/lib/money.ts:1`
- `apps/api/src/lib/money.ts:17`
- `apps/api/src/lib/money.ts:29`
- `apps/api/src/lib/money.ts:38`
- `apps/api/src/lib/money.ts:68`

Impact:
- Cent-level financial errors and inconsistent token/unit calculations under edge cases.

### 16. Medium - Full token material is stored in plaintext in multiple places

OWASP mapping:
- A02:2025 Cryptographic Failures

Why this is a problem:
- Generated STS tokens are stored directly in `generated_tokens.token`.
- SMS logs also persist the full outbound message body, which includes the token for delivery and resend flows.
- This increases the blast radius of any database read exposure and duplicates the same secret material unnecessarily.

Evidence:
- `apps/api/src/db/schema/generated-tokens.ts:37`
- `apps/api/src/db/schema/sms-logs.ts:31`
- `apps/api/src/routes/transactions.ts:203`

Impact:
- A database read or admin-panel exposure can reveal still-usable token material more broadly than necessary.

## Deferred Work

Planned for later:
- Dynamic security testing
- Load testing
- Callback abuse simulation
- Auth brute-force testing
- Authorization regression tests for staff-only routes

## Recommended Fix Order

1. Lock down transactions, meters, and mother-meter routes with proper role and ownership checks.
2. Restrict meter create/update operations to admin-only flows unless there is an explicit staff role model.
3. Apply `authRateLimit` to `/api/auth/*`.
4. Require header-only transport for M-Pesa callback tokens.
5. Remove or redact sensitive callback logging.
6. Replace in-memory rate limiting with Redis-backed shared rate limiting.
7. Disable public self-sign-up for the staff-only portal.
8. Restrict detailed health and queue health to internal/admin use.
9. Remove provider credentials from Gomelong query strings where the upstream API allows safer transport.
10. Add explicit timeouts and cancellation to outbound provider requests.
11. Move workers and automation to an explicit worker/scheduler process model.
12. Rewrite analytics and summary routes to avoid full-table scans and N+1 patterns.
13. Replace floating-point payment math with fixed-precision decimal handling.
14. Reduce or encrypt stored token material where operationally possible.
