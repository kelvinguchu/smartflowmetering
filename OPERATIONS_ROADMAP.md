# Staff Operations Roadmap

Review date: 2026-03-12

Purpose:
- Capture the missing staff capabilities in the current system.
- Define what should be implemented next across API, admin dashboard, queues, and notifications.
- Keep the roadmap aligned with the product rule that this is a staff-operated system, not a landlord/tenant portal.

Reference docs:
- `aboutapp.md`
- `apps/api/SECURITY_REVIEW.md`

## Operating Principles

These are non-negotiable for every new operations feature:

- Device-agnostic operations: staff actions must work from desktop and mobile, not assume staff are at a laptop.
- Security first: no shortcuts that expose tokens, credentials, or broad write access.
- Low latency first: user-facing checks and callbacks must stay fast; heavy work belongs in queues.
- No silent failure: every important background action must have status, retries, and auditability.
- Least privilege: support users should not automatically get every admin action.
- Recovery over heroics: normal failures should have a clear retry/recovery workflow, not depend on ad hoc database work.

## Current Operational Coverage

Already present in the codebase:

- Staff sign-in with `admin` and `user` roles.
- Meter CRUD and lookup.
- Transaction viewing and token resend.
- SMS log viewing and SMS resend.
- STK push initiation and query.
- Mother-meter balance and event management.
- Admin notifications and alert-job triggers.
- Failed transaction review and status updates.
- Raw Gomelong admin/provider endpoints.

This is a usable starting point, but it is still mostly CRUD plus support tools. It is not yet a complete operations platform.

## Missing Capabilities

### 1. Customer Recovery Workflows

Missing:
- "Customer did not receive token" guided recovery.
- "Customer paid but token generation failed" guided recovery.
- "Wrong phone number" correction and controlled resend flow.
- "Wrong meter number" review and escalation flow.
- "Customer lost token later" lookup and recovery flow.

Why it matters:
- These are daily support issues.
- Staff should not need to inspect multiple pages or database rows manually.

Target outcome:
- One support flow should show payment status, token status, SMS status, last resend, and allowed recovery actions.

### 2. Admin Token Operations

Missing:
- Productized flows for:
  - clear tamper token
  - clear credit token
  - key change token
  - set max power token
  - decoder change token
- Safe delivery channel after generation.
- Audit trail for who generated which admin token and why.
- Approval/confirmation for sensitive actions.

Why it matters:
- The provider integration exists, but the staff workflow does not.
- These are high-risk operations and need stricter controls than ordinary token resend.

Target outcome:
- Sensitive token actions should be explicit admin workflows with reason capture, audit logging, optional second confirmation, and secure delivery.

### 3. Failed SMS Operations

Missing:
- Retry policy dashboard for failed or queued SMS.
- Bulk retry for transient delivery failures.
- Retry reason and attempt history.
- Secondary provider fallback strategy.
- Detection of provider outage or delivery spike failures.

Why it matters:
- Manual single-message resend is not enough for real operations.

Target outcome:
- Staff can quickly identify delivery failures, retry safely, and see whether the issue is per-message or provider-wide.

### 4. Failed Payment And Token Recovery

Missing:
- Guided recovery for failed transactions.
- Explicit reprocess token generation action after a provider outage.
- Refund/cancel/resolve workflows with strong audit logging.
- Linkage between failed transaction, raw payment event, retry attempts, and final outcome.

Why it matters:
- Payment failures are operationally expensive and reputationally damaging.

Target outcome:
- Staff can move a failed purchase from detection to resolution without manual database intervention.

### 5. Customer Prompting And Revenue Protection

Missing:
- Low-balance prompts to customers or responsible contacts.
- Failed-purchase follow-up prompts.
- Reminders to buy when consumption pattern suggests imminent depletion.
- Post-outage prompts after service restoration.
- Configurable reminder rules by meter type or tariff group.

Why it matters:
- This supports revenue continuity and reduces inbound support load.

Target outcome:
- The system should proactively prompt likely purchases instead of waiting for support tickets.

### 6. Device-Friendly Staff Operations

Missing:
- Mobile-friendly admin dashboard workflows for critical actions.
- Actionable notifications that staff can handle from a phone.
- Alert acknowledgements and escalation flow.
- On-call style handling for urgent operations events.

Why it matters:
- Staff will not always be seated at a machine.
- Critical operations should not stall because someone is away from a desk.

Target outcome:
- The highest-value operational tasks must be completable from a phone in a few steps.

### 7. User And Role Administration

Missing:
- Admin user management routes and UI.
- Role assignment and suspension workflows.
- Narrower role model for support vs operations vs finance vs super admin.

Why it matters:
- Current role separation is too coarse for a growing operations team.

Target outcome:
- Access should match job function, not just "admin" or "user".

### 8. Audit And Compliance Operations

Missing:
- Audit-log viewing tools.
- Filters for sensitive actions.
- Traceability from action to actor, device, reason, and affected customer/meter.

Why it matters:
- Sensitive meter actions and payment recovery need defensible traceability.

Target outcome:
- Admins can review sensitive actions without database access.

### 9. Search And Support Workspace

Missing:
- Unified support search by:
  - phone number
  - meter number
  - transaction reference
  - M-Pesa receipt
- Single support view combining:
  - customer info
  - meter info
  - recent transactions
  - SMS delivery history
  - recovery actions

Why it matters:
- Support speed depends on one screen, not five separate tools.

Target outcome:
- Staff should resolve common issues from one search-driven workflow.

### 10. Bulk And Scheduled Operations

Missing:
- Bulk reminders.
- Bulk retries.
- Bulk alert acknowledgements.
- Scheduled campaign controls and rate limiting.

Why it matters:
- Operations does not scale if every action is one-by-one.

Target outcome:
- Staff can run controlled bulk workflows without harming latency or provider limits.

## Delivery Priorities

### P0 - Must Build First

- Unified support recovery flow for paid-but-not-completed cases.
- Admin token operations for tamper/clear-credit/key-change style actions.
- Failed SMS queue management with retries and provider health visibility.
- Mobile-friendly alerting for urgent operations issues.
- Admin user and role management.

Reason:
- These close the biggest operational gaps and reduce the amount of manual intervention.

### P1 - Build Next

- Customer prompting and purchase reminders.
- Failed transaction reprocessing workflow.
- Unified support search workspace.
- Audit-log viewer for sensitive operations.
- Bulk operational actions with strong limits.

Reason:
- These improve staff throughput and reduce support response time.

### P2 - Build After P1

- Advanced escalation rules.
- Multi-channel staff notifications.
- Smarter customer targeting and reminder heuristics.
- Richer finance/reconciliation workflow separation.

Reason:
- These are valuable but depend on stronger core operations workflows first.

## Security Requirements For New Features

- Sensitive token operations must be admin-only unless a narrower approved role is introduced.
- Every destructive or sensitive action must write an audit log with actor, reason, timestamp, and target entity.
- Tokens must never be logged or stored in plaintext outside the protected token path.
- Customer contact changes must require explicit validation and audit logging.
- Bulk actions must have hard caps, dry-run support where practical, and abuse-resistant rate limits.
- Notifications to staff must not leak secrets or full token material.

## Latency And Reliability Requirements For New Features

- Webhook handlers must remain fast and queue heavy work.
- Support search views must be index-backed and paginated.
- Bulk actions must enqueue work instead of blocking request threads.
- Mobile-critical screens should prefer a compact data model and avoid N+1 queries.
- Retries must be idempotent and traceable.

## Suggested Implementation Order

1. Define the exact RBAC matrix for support, operations, finance, and super admin.
2. Build a unified support recovery API surface for transaction, token, and SMS issues.
3. Build admin token-operation endpoints with audit logging and safe delivery.
4. Add failed-SMS operations, retry tooling, and provider health signals.
5. Add mobile-first operational alerts and actionable acknowledgement flows.
6. Build user-management and audit-log review surfaces.
7. Build customer reminder and prompting workflows.
8. Add bulk and scheduled operations after the single-item workflows are solid.

## Immediate Build Candidates

The best next implementation slices are:

- Admin token actions workflow
- Failed SMS recovery tooling
- Unified support transaction recovery
- User management API and UI

These have the highest operational value and the clearest business need.
