# Backend Pending Review And Handoff

Review date: 2026-03-15

Purpose:
- give the next agent a current backend map
- record what is already built
- record what `aboutapp.md` still gets wrong
- record what is truly pending
- record the highest-risk tightening work

Scope:
- backend only
- `apps/api`
- local Docker workflow for backend services
- backend-related docs in `apps/docs/api-docs`
- product reference in `aboutapp.md`
- security reference in `apps/api/SECURITY_REVIEW.md`

## 1. Current Reality

The backend is not at an early CRUD stage anymore.

It already includes:
- staff auth and RBAC
- admin user management
- audit-log read APIs
- M-Pesa paybill and STK surfaces
- Gomelong token generation
- admin token workflows
- HostPinnacle SMS with TextSMS fallback
- HostPinnacle DLR webhook ingestion
- TextSMS DLR pull-sync
- SMS recovery and provider health endpoints
- landlord mobile access and dashboard/history endpoints
- tenant serial-based mobile access and history/token endpoints
- FCM-ready app notification persistence and worker delivery pipeline

So the main remaining work is not broad feature absence. It is:
- authorization tightening
- response minimization
- recovery-path completion
- provider failure policy cleanup
- security/performance verification

## 2. Actual Backend Stack

`aboutapp.md` is outdated on core backend choices.

Current backend stack:
- runtime: Node 22
- HTTP framework: Hono
- auth: Better Auth
- ORM: Drizzle ORM
- DB driver: `postgres`
- queue: BullMQ
- cache/queue broker: Redis
- validation: Zod
- push notifications: Firebase Admin SDK
- local process runner: `tsx`

Evidence:
- [apps/api/package.json](D:\smartflowmetering\apps\api\package.json)
- [apps/api/src/app.ts](D:\smartflowmetering\apps\api\src\app.ts)
- [apps/api/src/index.ts](D:\smartflowmetering\apps\api\src\index.ts)

Important correction:
- `aboutapp.md` says Bun + Elysia
- current backend is Node + Hono

This is not pending work. It is documentation drift.

## 3. Current Local Docker Model

Local dev now intentionally runs only:
- `api`
- `worker`
- `postgres`
- `redis`

Local `admin-dashboard` was removed from [docker-compose.yml](D:\smartflowmetering\docker-compose.yml) on purpose.

Production-specific or optional:
- Dokploy compose still contains deployment-oriented services and routing
- local `adminer` remains behind the `ops` profile

Current local compose behavior:
- `api` uses the repo-root build context and [apps/api/Dockerfile](D:\smartflowmetering\apps\api\Dockerfile)
- `worker` reuses the same `smartflowmetering-api` image with `SFM_PROCESS_ROLE=worker`
- `postgres` and `redis` stay internal on the Docker network

Important local note for the next agent:
- local compose rebuilds can be expensive after cache clears
- do not rebuild unless code or image config changed
- if the DB volume is fresh, verify whether schema already exists before trying heavyweight push paths

## 4. Process Model

The backend is explicitly split into HTTP vs async processing.

Process roles:
- `api`
- `worker`
- `all`

Current startup logic:
- `api` starts HTTP only
- `worker` starts queues and alert automation only
- `all` starts both

Evidence:
- [apps/api/src/index.ts](D:\smartflowmetering\apps\api\src\index.ts)

Why it matters:
- request latency stays low
- provider failures do not block HTTP paths as much
- retryable work lives in queues

## 5. Domain Model That The Next Agent Must Preserve

This is more accurate than `aboutapp.md` in some places.

Landlord model:
- landlord is the app-level owned customer identity
- landlord owns mother meters
- landlord gets mobile auth and landlord-scoped data

Tenant model:
- tenant does not own a sub-meter in the core model
- tenant app access is allowed
- tenant onboarding is by sub-meter serial number
- tenant access is not ownership

Operational model:
- staff web/admin access is separate from landlord/tenant mobile access
- admin and user are staff roles
- landlord and tenant are mobile-access actors, not staff roles

This matches:
- [AGENTS.md](D:\smartflowmetering\AGENTS.md)
- the current mobile route design

## 6. Aboutapp Drift

These `aboutapp.md` assumptions are stale and should not be treated as pending backend work:

### 6.1 Runtime / Framework Drift

- `aboutapp.md`: Bun + Elysia
- current backend: Node + Hono

### 6.2 Manufacturer Routing Drift

- `aboutapp.md`: multiple direct manufacturer brand integrations
- current backend: Gomelong is the active token provider path
- brand-based provider routing was intentionally removed for now

### 6.3 Customer Access Drift

- `aboutapp.md`: customers do not need app or web access
- current backend: landlord mobile access and tenant mobile access already exist

### 6.4 Frontend / Local Stack Drift

- local Docker no longer includes the admin dashboard
- local stack is backend-only plus DB/Redis

### 6.5 Notification Semantics Drift

`aboutapp.md` does not reflect the current distinction between:
- event notifications
- ongoing tracking data

This matters especially for landlord flows:
- ongoing prepaid/postpaid financial tracking belongs in dashboard/history/timeline endpoints
- not every state change should be modeled as a push notification

## 7. High-Level Route Surface

This is the current backend surface that already exists.

### 7.1 Staff / Admin Surface

Core staff routes:
- `/api/auth/*`
- `/api/health`
- `/api/mpesa`
- `/api/meters`
- `/api/tariffs`
- `/api/transactions`
- `/api/sms`
- `/api/sms/recovery`
- `/api/sms/webhooks`
- `/api/applications`
- `/api/mother-meters`
- `/api/notifications`
- `/api/failed-transactions`
- `/api/admin-tokens`
- `/api/audit-logs`
- `/api/auth-security`
- `/api/customer-prompts`
- `/api/support-recovery`
- `/api/users`
- `/api/gomelong`

Evidence:
- [apps/api/src/app.ts](D:\smartflowmetering\apps\api\src\app.ts)

### 7.2 Mobile Surface

Landlord:
- `/api/mobile/landlord-access`

Tenant:
- `/api/mobile/tenant-access`

These are already substantial and not just placeholders.

## 8. Auth Models

### 8.1 Staff Auth

- Better Auth session-based auth
- RBAC permission map in backend
- admin user-management APIs exist
- auth security APIs exist

Relevant files:
- [apps/api/src/lib/auth.ts](D:\smartflowmetering\apps\api\src\lib\auth.ts)
- [apps/api/src/lib/auth-middleware.ts](D:\smartflowmetering\apps\api\src\lib\auth-middleware.ts)
- [apps/api/src/lib/rbac.ts](D:\smartflowmetering\apps\api\src\lib\rbac.ts)
- [apps/api/src/routes/users.ts](D:\smartflowmetering\apps\api\src\routes\users.ts)
- [apps/api/src/routes/auth-security.ts](D:\smartflowmetering\apps\api\src\routes\auth-security.ts)

### 8.2 Landlord Mobile Auth

- OTP-based mobile login
- token-based access after verification

Relevant files:
- [apps/api/src/routes/landlord-access.ts](D:\smartflowmetering\apps\api\src\routes\landlord-access.ts)
- [apps/api/src/services/landlord-mobile-auth.service.ts](D:\smartflowmetering\apps\api\src\services\landlord-mobile-auth.service.ts)
- [apps/api/src/lib/landlord-access-middleware.ts](D:\smartflowmetering\apps\api\src\lib\landlord-access-middleware.ts)

### 8.3 Tenant Mobile Access

- bootstrap by sub-meter serial number
- bearer-like access token after bootstrap

Relevant files:
- [apps/api/src/routes/tenant-access.ts](D:\smartflowmetering\apps\api\src\routes\tenant-access.ts)
- [apps/api/src/services/tenant-access.service.ts](D:\smartflowmetering\apps\api\src\services\tenant-access.service.ts)
- [apps/api/src/lib/tenant-access-middleware.ts](D:\smartflowmetering\apps\api\src\lib\tenant-access-middleware.ts)

## 9. Current Messaging Model

### 9.1 SMS

Primary:
- HostPinnacle

Strict fallback:
- TextSMS

Current behavior:
- always try HostPinnacle first
- use TextSMS only if HostPinnacle fails
- HostPinnacle DLRs come by webhook
- TextSMS DLRs are synced by pull

Relevant files:
- [apps/api/src/services/sms.service.ts](D:\smartflowmetering\apps\api\src\services\sms.service.ts)
- [apps/api/src/services/sms-provider-transports.ts](D:\smartflowmetering\apps\api\src\services\sms-provider-transports.ts)
- [apps/api/src/services/textsms-dlr.service.ts](D:\smartflowmetering\apps\api\src\services\textsms-dlr.service.ts)
- [apps/api/src/routes/sms-webhooks.ts](D:\smartflowmetering\apps\api\src\routes\sms-webhooks.ts)
- [apps/api/src/routes/sms-recovery.ts](D:\smartflowmetering\apps\api\src\routes\sms-recovery.ts)

### 9.2 App Notifications

Current backend supports:
- app notification persistence
- queue-based delivery attempts
- FCM-ready worker path
- landlord and tenant notification feeds

But live app/device verification is still limited because the app is not built yet.

Relevant files:
- [apps/api/src/routes/app-notifications.ts](D:\smartflowmetering\apps\api\src\routes\app-notifications.ts)
- [apps/api/src/services/app-notifications.service.ts](D:\smartflowmetering\apps\api\src\services\app-notifications.service.ts)
- [apps/api/src/queues/processors/app-notification.processor.ts](D:\smartflowmetering\apps\api\src\queues\processors\app-notification.processor.ts)
- [apps/api/src/lib/firebase-admin.ts](D:\smartflowmetering\apps\api\src\lib\firebase-admin.ts)

## 10. Current Payment And Token Model

Implemented:
- M-Pesa callback ingestion
- STK push routes
- queued payment processing
- Gomelong-based credit token generation
- admin token workflows for tamper and related operations
- token storage protection
- token resend and support lookup surfaces

Relevant files:
- [apps/api/src/routes/mpesa](D:\smartflowmetering\apps\api\src\routes\mpesa)
- [apps/api/src/services/mpesa](D:\smartflowmetering\apps\api\src\services\mpesa)
- [apps/api/src/services/meter-providers/gomelong-client.ts](D:\smartflowmetering\apps\api\src\services\meter-providers\gomelong-client.ts)
- [apps/api/src/routes/admin-tokens.ts](D:\smartflowmetering\apps\api\src\routes\admin-tokens.ts)
- [apps/api/src/lib/token-protection.ts](D:\smartflowmetering\apps\api\src\lib\token-protection.ts)

## 11. Current Landlord Backend Surface

Already implemented:
- OTP auth
- `me`
- summary
- mother-meter list
- property analytics
- purchases
- history
- timeline
- threshold summaries
- threshold history
- exceptional-state summaries
- notification feed
- device-token registration

Docs already exist for these flows in:
- [apps/docs/api-docs/landlord-access.e2e.md](D:\smartflowmetering\apps\docs\api-docs\landlord-access.e2e.md)
- [apps/docs/api-docs/landlord-dashboard.e2e.md](D:\smartflowmetering\apps\docs\api-docs\landlord-dashboard.e2e.md)
- [apps/docs/api-docs/landlord-history.e2e.md](D:\smartflowmetering\apps\docs\api-docs\landlord-history.e2e.md)
- [apps/docs/api-docs/landlord-property-analytics.e2e.md](D:\smartflowmetering\apps\docs\api-docs\landlord-property-analytics.e2e.md)
- [apps/docs/api-docs/landlord-timeline.e2e.md](D:\smartflowmetering\apps\docs\api-docs\landlord-timeline.e2e.md)
- [apps/docs/api-docs/landlord-thresholds.e2e.md](D:\smartflowmetering\apps\docs\api-docs\landlord-thresholds.e2e.md)
- [apps/docs/api-docs/landlord-exceptional-state.e2e.md](D:\smartflowmetering\apps\docs\api-docs\landlord-exceptional-state.e2e.md)

Important semantic constraint:
- landlord tracking endpoints provide derived financial state
- they do not provide real physical meter usage telemetry

## 12. Current Tenant Backend Surface

Already implemented:
- bootstrap via sub-meter serial
- `me`
- summary
- purchases
- purchase rollups
- token deliveries
- token delivery detail
- exceptional-state endpoint
- notification feed
- read ACKs
- device-token registration

Docs already exist for these flows in:
- [apps/docs/api-docs/tenant-access.e2e.md](D:\smartflowmetering\apps\docs\api-docs\tenant-access.e2e.md)
- [apps/docs/api-docs/tenant-dashboard.e2e.md](D:\smartflowmetering\apps\docs\api-docs\tenant-dashboard.e2e.md)
- [apps/docs/api-docs/tenant-history.e2e.md](D:\smartflowmetering\apps\docs\api-docs\tenant-history.e2e.md)
- [apps/docs/api-docs/tenant-token-deliveries.e2e.md](D:\smartflowmetering\apps\docs\api-docs\tenant-token-deliveries.e2e.md)
- [apps/docs/api-docs/tenant-exceptional-state.e2e.md](D:\smartflowmetering\apps\docs\api-docs\tenant-exceptional-state.e2e.md)

## 13. Data And Schema Notes

Important schema facts:
- Better Auth uses `text` IDs, not Postgres UUIDs
- auth-related foreign-key-like references were aligned to `text`
- generated auth schema is in:
  - [apps/api/src/db/schema/auth.generated.ts](D:\smartflowmetering\apps\api\src\db\schema\auth.generated.ts)

Current schema areas to be aware of:
- `transactions`
- `generated_tokens`
- `sms_logs`
- `customer_app_notifications`
- `customer_device_tokens`
- `tenant_app_accesses`
- `mother_meters`
- `mother_meter_events`
- `meter_applications`

Migration note for the next agent:
- this DB has repeatedly been kept aligned via `db:push:force` in local/dev flows
- do not assume `db:migrate` is always the correct local recovery path after drift
- verify actual DB state before replaying long migration chains

## 14. What Is Already In Good Shape

- M-Pesa callback ingestion and queued processing
- STK route surface
- fixed-precision money handling
- Redis-backed rate limiting
- explicit API vs worker split
- protected token storage and token redaction
- HostPinnacle primary SMS and TextSMS fallback
- HostPinnacle DLR webhook path
- TextSMS DLR sync path
- SMS recovery and provider health
- admin token operations
- RBAC permission model
- admin user-management APIs
- audit-log read APIs
- support recovery
- landlord backend data surfaces
- tenant backend data surfaces

## 15. True Pending Backend Work

These are the real backend gaps now.

### 15.1 Access Control Tightening

This is still the most important unfinished backend item.

Pending:
- review all staff read endpoints for object-level authorization
- confirm `user` staff cannot see broader operational data than necessary
- confirm `admin`-only mutations remain consistent everywhere
- re-check support recovery, transactions, meters, mother meters, and history surfaces
- add or expand regression coverage specifically for object-level authorization

This remains open according to:
- [apps/api/SECURITY_REVIEW.md](D:\smartflowmetering\apps\api\SECURITY_REVIEW.md)

### 15.2 Response Minimization

Pending:
- reduce staff payloads to the minimum required operational fields
- confirm landlord payloads never expose commission/company-earnings data
- confirm tenant payloads stay strictly sub-meter scoped
- confirm support/staff payloads do not expose unnecessary provider internals or protected token material

### 15.3 Failed Purchase And Invalid Meter Recovery

`aboutapp.md` explicitly expects strong handling here.

Pending:
- tighten failed transaction state transitions
- improve support ergonomics for:
  - invalid meter number
  - below-minimum payment
  - provider failure
  - token generated but not delivered
  - SMS failure after successful payment
- make manual intervention paths more explicit and auditable

### 15.4 Manufacturer Failure Policy

Pending:
- make Gomelong retry/backoff policy explicit and documented
- classify retryable vs non-retryable provider failures clearly
- ensure staff can distinguish:
  - transient provider failure
  - invalid meter/provider contract failure
  - token generated late vs not generated at all

### 15.5 SMS Operations Tightening

Pending:
- cooldown and dedupe for repeated SMS provider outage alerts
- fallback policy tuning so retries do not create noise or duplicate sends
- DLR sync backlog control review
- final operator-facing clarity on which provider was used and why

### 15.6 Staff Workflow Polish

Pending:
- verify that route-level capability maps actually feel like product workflows for staff
- especially review:
  - failed transaction resolution
  - support recovery
  - admin token usage review
  - SMS delivery troubleshooting

### 15.7 Landlord And Tenant Backend Refinement

Core surfaces exist. Remaining work is refinement, not first implementation.

Pending:
- query-cost review on landlord analytics under larger data volumes
- pagination/filter consistency review across tenant and landlord list endpoints
- notification/event semantics review so long-lived financial state stays in tracking endpoints
- final token/device-token ownership alignment review against the domain rules in `AGENTS.md`

### 15.8 Real Usage Telemetry

This remains blocked by upstream data availability.

Important:
- current Gomelong surface does not provide true daily consumption telemetry in the documented endpoints we have
- current landlord/tenant “usage-like” views are derived from purchases and financial events
- actual meter-reading-based daily usage is not implemented and should not be misrepresented as if it exists

This is a data-source limitation, not just missing coding.

## 16. Security Tightening Still Pending

Most important:
- object-level authorization completion
- response minimization on staff routes
- provider credential exposure review for Gomelong query-string auth
- dynamic security testing:
  - brute-force
  - callback abuse
  - authorization regression
- complete review against [apps/api/SECURITY_REVIEW.md](D:\smartflowmetering\apps\api\SECURITY_REVIEW.md)

## 17. Performance Tightening Still Pending

Pending:
- deeper benchmarks for:
  - transaction-heavy staff flows
  - support-recovery
  - SMS recovery/provider health
  - larger landlord/tenant datasets
- mother-meter analytics query-shape review under scale
- queue backlog and retry behavior under provider degradation

## 18. Testing Context

Current backend already has broad E2E coverage.

Examples:
- auth and health
- applications onboarding
- M-Pesa purchase and signature checks
- user management
- audit logs
- support recovery
- SMS DLR webhook
- SMS recovery
- SMS provider health
- SMS provider alerts
- landlord access/dashboard/history/timeline/thresholds/analytics
- tenant access/dashboard/history/exceptional-state/token-deliveries

This means the next agent should prefer:
- updating or extending existing E2E files
- not inventing entirely new testing structure unless necessary

## 19. Operational Notes For The Next Agent

### 19.1 Local Docker

Current local stack:
- `api`
- `worker`
- `postgres`
- `redis`

No local admin-dashboard in local compose.

### 19.2 Drizzle

If the DB is fresh:
- verify state first with `psql \dt`

If schema already exists:
- do not rerun heavyweight migration flows blindly

If local drift exists:
- `db:push:force` may be the practical local recovery path
- but check before doing a long reinstall-based path

### 19.3 Release Image Limitation

The runtime `api` image is slim:
- it has the app code
- it may not include all dev/test tooling in the way a full dev shell would

So for local DB/schema operations:
- verify what is actually in the running image before assuming tooling availability

### 19.4 Docker Cost Awareness

The user is highly sensitive to:
- disk growth
- repeated rebuilds
- extra containers left running
- CPU spikes from disposable test containers

So the next agent should:
- avoid unnecessary rebuilds
- use `--rm` on disposable test containers
- never leave extra containers running
- inspect actual DB/runtime state before taking heavyweight recovery paths

## 20. Recommended Next Order

### P0

- full object-level authorization pass
- response minimization pass
- failed purchase / invalid meter / token recovery tightening
- SMS provider outage dedupe and fallback-policy cleanup

### P1

- Gomelong retry/backoff classification and documentation
- support workflow polish
- broader performance and security verification

### P2

- landlord/tenant analytics refinement under larger datasets
- true usage telemetry integration if and when a real reading source becomes available

## 21. Short Summary For The Next Codex Process

Start from this assumption:

- the backend platform is already broad
- do not spend time rebuilding surfaces that already exist
- the most valuable remaining work is safety and recovery correctness

If choosing one next task, choose:
- authorization tightening and response minimization first

That is the highest-risk remaining gap and the most defensible next backend step.
