# Backend Remaining Work

Review date: 2026-03-17

Purpose:

- record what is still missing after the latest backend hardening pass
- separate true remaining work from already-completed fixes
- give the next Codex process a practical starting point

Scope:

- backend only
- `apps/api`

## 1. Recently Completed

These are no longer pending:

- STK callback path corrected and verified end to end
- live STK -> callback -> token -> SMS flow confirmed working
- staff/admin split tightened on highest-risk staff routes:
  - `transactions`
  - `meters`
  - `mother-meters`
  - `sms`
- application review payloads narrowed for support staff
- failed transaction queue browsing narrowed for support staff
- support recovery no longer exposes admin-token history to support staff
- support recovery assessments now expose structured closure expectations and `allowedResolutionActions` aligned with failed-transaction workflows
- `support-recovery` now requires explicit exact-match scope fields for support staff (`phoneNumber`, `meterNumber`, `transactionId`, or `mpesaReceiptNumber`); admin retains broader `q` search behavior
- failed transaction closure now requires notes and blocks terminal-to-terminal status jumps
- failed transaction closure now requires an explicit reason-matched `resolutionAction`, exposes allowed closure actions in workflow guidance, and records the chosen action in audit logs
- landlord dashboard mother-meter and purchase views no longer expose internal meter, mother-meter, sub-meter, or property IDs
- landlord history mother-meter detail and usage-history views no longer expose internal IDs
- landlord activity and sub-meter detail views no longer expose internal customer-facing IDs
- tenant summary no longer exposes internal meter, mother-meter, or property IDs
- tenant token-delivery detail no longer exposes SMS provider internals
- support/staff resend flows preserved where operationally needed
- support broad reads on `app-notifications` and `customer-prompts` now require customer scope (phoneNumber, meterNumber, or landlordId); unscoped returns 403
- support blind-ID bypass on app-notification requeue and device-token deactivation closed: scope must match the target resource
- support blind-ID bypass on `sms-recovery` sync/retry operations closed: support must provide matching phoneNumber, meterNumber, or transactionId scope
- support blind-ID bypass on direct `sms/resend/:id` closed: support must provide matching phoneNumber, meterNumber, or transactionId scope while admin retains direct resend access
- `audit-logs` now has route-level admin defense-in-depth in addition to RBAC, and both list/detail admin-only access are regression-covered
- landlord timeline and timeline drill-down payloads no longer expose `referenceId`, `transactionId`, `mpesaReceiptNumber`, or customer phone numbers
- landlord thresholds, exceptional-state, and property analytics payloads reviewed and confirmed to avoid internal IDs, customer phone numbers, receipt numbers, and company-financial fields
- application detail for support now restricted to pending-only; approved applications return 404 for support while admin retains full access
- shared scope guard `ensureSupportScopedCustomerLookup()` added in `staff-route-access.ts` and applied consistently
- E2E regressions added: unscoped 403, mismatched-scope 403, scoped support success, and admin bypass for app-notifications and customer-prompts
- E2E regression added: support gets 404 on approved application detail, admin sees full detail
- E2E regression added: support is blocked from mother-meter event history while admin event-history access remains available
- E2E regression added: support is blocked from transaction reference lookup while admin direct reference lookup remains available
- host-side E2E test infrastructure added: `docker-compose.test.yml` + `scripts/e2e-env-setup.ts` + `test:e2e:local` script
- SMS duplicate-send retry bug fixed when provider success has empty `msgId`
- HostPinnacle `transactionId` now stored as `sms_logs.provider_reference`
- direct provider test script added:
  - [apps/api/scripts/test-sms-provider.ts](D:\smartflowmetering\apps\api\scripts\test-sms-provider.ts)

Current reference successful live run:

- receipt: `UCH8P9FCHR`
- transaction: `OHM-20260317-RH5DC`
- SMS status: `sent`
- `provider_reference`: `1079964918631779971`

## 2. P0 Conclusive Status

### 2.1 P0 Already Completed

These `P0` slices are materially done:

- highest-risk staff/admin route hardening:
  - `transactions`
  - `meters`
  - `mother-meters`
  - `sms`
- support-facing queue/recovery tightening:
  - `applications` (pending-only for support detail; approved → 404)
  - `failed-transactions`
  - `support-recovery` (structured resolution vocabulary now aligned with failed-transactions)
- support customer-scope enforcement:
  - `app-notifications` (reads, requeue, device-token deactivation all require matching scope)
  - `customer-prompts` (reads require scope)
- support troubleshooting scope enforcement:
  - `sms-recovery` (`sync-status`, `retry`, `retry-batch` require matching phoneNumber, meterNumber, or transactionId scope for support)
  - `sms` direct resend (`/sms/resend/:id` now requires matching phoneNumber, meterNumber, or transactionId scope for support)
- failed transaction workflow policy:
  - closure now requires notes
  - closure now requires an explicit reason-matched resolution action
  - direct terminal-to-terminal status jumps are blocked
  - operator guidance is included in failed-transaction listing, including recommended closure status and allowed resolution actions
- customer-facing payload minimization already completed on:
  - tenant summary
  - tenant token-delivery detail
  - landlord dashboard mother-meter list
  - landlord dashboard purchases
  - landlord mother-meter detail
  - landlord usage history
  - landlord activity
  - landlord sub-meter detail
  - landlord timeline and timeline drill-downs
  - landlord thresholds
  - landlord exceptional-state
  - landlord property analytics summary, rollups, and mother-meter comparisons
- live payment/SMS path fixes:
  - STK callback path corrected
  - duplicate SMS retry bug fixed
  - HostPinnacle `transactionId` persisted as `provider_reference`

### 2.2 P0 Still Open

`P0` is not fully complete yet.

The remaining `P0` work is now narrower:

- finish any remaining support/operator workflow clarity outside the now-aligned failed-transaction and support-recovery surfaces

### 2.3 Best Next P0 Order

If continuing `P0` only, take it in this order:

1. finish support/operator workflow clarity for post-payment failure states
2. add any last small regression locks only if a sensitive route changes during that work

## 3. True Remaining Priorities

## P0

### 3.1 Full Staff Authorization Pass

This pass is materially complete.

What is still needed:

- keep adding small regression locks for sensitive admin-only history and operations routes as they are confirmed, but the broad authorization sweep is otherwise largely complete

Already hardened:

- `transactions` — support must scope by phone/meter/txnId/receipt
- `meters` — support searches by meterNumber only; admin browses all
- `mother-meters` — admin-only listing
- `sms` — admin-only broad reads
- `applications` — support pending-only detail; approved → 404
- `failed-transactions` — support pending_review only
- `support-recovery` — conditional admin flag
- `support-recovery` — search criteria are required and admin-token history stays admin-only; remaining question is whether support reads should be object-scoped or intentionally broad
- `support-recovery` — support now must use explicit exact-match scope fields; admin-token history stays admin-only and admin retains broader `q` search
- `app-notifications` — scope + scope-match for requeue/deactivate
- `customer-prompts` — scope required for support reads
- `sms-recovery` — support list already scoped by search criteria; sync/retry operations now require matching scope

Customer-facing landlord payloads still likely need review:

- remaining landlord-facing surfaces should now be treated as verification-only unless a new regression is found

## 3.2 Response Minimization

Broad response minimization is materially complete for the currently identified customer and support surfaces.

What is still needed:

- audit all remaining staff payloads for unnecessary provider/internal fields
- keep landlord payload regression coverage in place so commission/company earnings do not reappear
- confirm tenant payloads remain strictly sub-meter scoped
- confirm support payloads expose only operationally necessary fields

Current sweep result:

- no new clear landlord or tenant payload leaks were identified in the latest codebase sweep
- the remaining backend question is now mostly authorization intent on `support-recovery`, not broad response minimization drift

## 3.3 Failed Purchase And Recovery Workflow Tightening

The routes exist, and basic closure policy is improved, but workflow polish is still incomplete.

What is still needed:

- make manual intervention paths more explicit and auditable

## P1

### 3.4 Gomelong Failure Policy

What is still needed:

- classify retryable vs non-retryable Gomelong errors
- document retry/backoff policy clearly
- ensure staff can distinguish:
  - transient provider failure
  - invalid meter/provider-side contract failure
  - delayed token vs no token

Note:

- temporary benchmark-only Gomelong stubbing has already been removed

## 3.5 SMS Operations Polish

Major bug fixed, but operations work remains.

What is still needed:

- dedupe/cooldown for repeated SMS provider outage alerts
- clearer operator-facing visibility into which provider was used and why
- DLR sync backlog/review policy
- final review of fallback behavior under provider degradation

## 3.6 Security Verification Pass

What is still needed:

- re-run the backend against `apps/api/SECURITY_REVIEW.md`
- dynamic testing for:
  - brute-force/auth abuse
  - callback abuse
  - authorization regression
- review sensitive provider auth patterns and exposure points

## P2

### 3.7 Performance Review Under Larger Data Volumes

What is still needed:

- landlord analytics query-shape review under scale
- mother-meter query/performance review
- recovery/admin flows benchmark review on larger datasets
- queue backlog behavior review under provider degradation

## 3.8 Landlord/Tenant Refinement

Core backend surfaces exist. Remaining work is refinement.

What is still needed:

- pagination/filter consistency review
- notification-vs-tracking semantics cleanup
- final device-token and ownership-alignment review against `AGENTS.md`

## 3.9 Real Usage Telemetry

Still not implemented.

Current reality:

- current landlord/tenant usage-like views are derived from purchases and financial events
- true meter-reading daily usage telemetry is not available from the current upstream path

This remains blocked by upstream data availability, not just backend code.

## 4. Suggested Next Order

If continuing backend work now, take it in this order:

1. finish failed purchase and recovery workflow tightening
2. formalize Gomelong failure policy
3. finish SMS ops polish
4. do the broader security verification pass
5. move into performance and refinement work

## 5. Files Representing The Current Fix Set

These are the main current changes worth preserving before further work:

- [apps/api/src/routes/mpesa/stk-routes.ts](D:\smartflowmetering\apps\api\src\routes\mpesa\stk-routes.ts)
- [apps/api/src/queues/processors/sms.processor.ts](D:\smartflowmetering\apps\api\src\queues\processors\sms.processor.ts)
- [apps/api/src/queues/processors/sms-result.ts](D:\smartflowmetering\apps\api\src\queues\processors\sms-result.ts)
- [apps/api/src/services/sms-provider-transports.ts](D:\smartflowmetering\apps\api\src\services\sms-provider-transports.ts)
- [apps/api/src/services/sms.types.ts](D:\smartflowmetering\apps\api\src\services\sms.types.ts)
- [apps/api/src/db/schema/sms-logs.ts](D:\smartflowmetering\apps\api\src\db\schema\sms-logs.ts)
- [apps/api/src/db/migrations/0019_tense_the_anarchist.sql](D:\smartflowmetering\apps\api\src\db\migrations\0019_tense_the_anarchist.sql)
- [apps/api/tests/sms-result.test.ts](D:\smartflowmetering\apps\api\tests\sms-result.test.ts)
- [apps/api/tests/sms-provider-transports.test.ts](D:\smartflowmetering\apps\api\tests\sms-provider-transports.test.ts)
- [apps/api/scripts/test-sms-provider.ts](D:\smartflowmetering\apps\api\scripts\test-sms-provider.ts)
- [apps/api/src/lib/staff-route-access.ts](D:\smartflowmetering\apps\api\src\lib\staff-route-access.ts)
- [apps/api/src/routes/app-notifications.ts](D:\smartflowmetering\apps\api\src\routes\app-notifications.ts)
- [apps/api/src/routes/customer-prompts.ts](D:\smartflowmetering\apps\api\src\routes\customer-prompts.ts)
- [apps/api/src/validators/app-notifications.ts](D:\smartflowmetering\apps\api\src\validators\app-notifications.ts)
- [apps/api/src/services/application-onboarding.service.ts](D:\smartflowmetering\apps\api\src\services\application-onboarding.service.ts)
- [apps/api/src/services/customer-device-tokens.service.ts](D:\smartflowmetering\apps\api\src\services\customer-device-tokens.service.ts)
- [apps/api/src/lib/rbac.ts](D:\smartflowmetering\apps\api\src\lib\rbac.ts)
- [apps/api/src/routes/tariffs.ts](D:\smartflowmetering\apps\api\src\routes\tariffs.ts)
- [apps/api/src/routes/landlord-access.ts](D:\smartflowmetering\apps\api\src\routes\landlord-access.ts)
- [apps/api/src/routes/sms-recovery.ts](D:\smartflowmetering\apps\api\src\routes\sms-recovery.ts)
- [apps/api/src/services/landlord-timeline.service.ts](D:\smartflowmetering\apps\api\src\services\landlord-timeline.service.ts)
- [apps/api/src/services/landlord-timeline.types.ts](D:\smartflowmetering\apps\api\src\services\landlord-timeline.types.ts)
- [apps/api/src/services/landlord-timeline.utils.ts](D:\smartflowmetering\apps\api\src\services\landlord-timeline.utils.ts)
- [apps/api/src/services/landlord-sub-meter-timeline.service.ts](D:\smartflowmetering\apps\api\src\services\landlord-sub-meter-timeline.service.ts)
- [apps/api/src/services/landlord-sub-meter.types.ts](D:\smartflowmetering\apps\api\src\services\landlord-sub-meter.types.ts)
- [apps/api/src/services/sms-recovery.service.ts](D:\smartflowmetering\apps\api\src\services\sms-recovery.service.ts)
- [apps/api/src/validators/sms-recovery.ts](D:\smartflowmetering\apps\api\src\validators\sms-recovery.ts)
- [apps/api/tests/e2e/app-notifications.e2e.test.ts](D:\smartflowmetering\apps\api\tests\e2e\app-notifications.e2e.test.ts)
- [apps/api/tests/e2e/customer-prompts.e2e.test.ts](D:\smartflowmetering\apps\api\tests\e2e\customer-prompts.e2e.test.ts)
- [apps/api/tests/e2e/api-health-auth.e2e.test.ts](D:\smartflowmetering\apps\api\tests\e2e\api-health-auth.e2e.test.ts)
- [apps/api/tests/e2e/landlord-timeline.e2e.test.ts](D:\smartflowmetering\apps\api\tests\e2e\landlord-timeline.e2e.test.ts)
- [apps/api/tests/e2e/landlord-timeline-detail.e2e.test.ts](D:\smartflowmetering\apps\api\tests\e2e\landlord-timeline-detail.e2e.test.ts)
- [apps/api/tests/e2e/rbac-permissions.e2e.test.ts](D:\smartflowmetering\apps\api\tests\e2e\rbac-permissions.e2e.test.ts)
- [apps/api/tests/e2e/sms-recovery.e2e.test.ts](D:\smartflowmetering\apps\api\tests\e2e\sms-recovery.e2e.test.ts)
- [apps/api/scripts/e2e-env-setup.ts](D:\smartflowmetering\apps\api\scripts\e2e-env-setup.ts)
- [docker-compose.test.yml](D:\smartflowmetering\docker-compose.test.yml)

## 6. Short Summary

The backend is not missing broad platform features.

The remaining work is mostly:

- recovery-path polish
- provider failure policy clarity
- security/performance verification

If choosing one next task, choose:

- formalize Gomelong failure policy and operator guidance so retryable vs non-retryable provider failures are explicit in backend behavior
