# Smart Flow Metering API — Architecture & Reference

> Hono + Node.js backend for prepaid/postpaid utility metering with M-Pesa payments, STS token generation, SMS delivery, and mobile access for landlords and tenants.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Entry Point & Process Roles](#entry-point--process-roles)
3. [Middleware Stack](#middleware-stack)
4. [Authentication & Authorization](#authentication--authorization)
5. [API Routes](#api-routes)
6. [Database Schema](#database-schema)
7. [Job Queues](#job-queues)
8. [Services Layer](#services-layer)
9. [SMS Delivery](#sms-delivery)
10. [Mobile Access (Landlord & Tenant)](#mobile-access-landlord--tenant)
11. [Configuration & Environment](#configuration--environment)
12. [Key Patterns](#key-patterns)

---

## System Overview

```
┌──────────────┐     ┌──────────────┐     ┌───────────────┐
│ Admin        │────▶│              │────▶│  PostgreSQL    │
│ Dashboard    │     │   Hono API   │     │  (18-alpine)   │
└──────────────┘     │   (Node 22)  │     └───────────────┘
                     │              │
┌──────────────┐     │  ┌────────┐  │     ┌───────────────┐
│ M-Pesa       │────▶│  │ BullMQ │──│────▶│  Redis 8      │
│ Callbacks    │     │  └────────┘  │     └───────────────┘
└──────────────┘     └──────┬───────┘
                            │
┌──────────────┐     ┌──────▼───────┐     ┌───────────────┐
│ Landlord App │────▶│   Worker     │────▶│  Gomelong API  │
│ Tenant App   │     │  (same image)│     │  (STS tokens)  │
└──────────────┘     └──────────────┘     └───────────────┘
                            │
                     ┌──────▼───────┐
                     │  SMS / FCM   │
                     │  Providers   │
                     └──────────────┘
```

**Tech stack**: Hono (HTTP), Drizzle ORM (PostgreSQL), BullMQ (Redis queues), Zod (validation), Better Auth (admin auth), Firebase Admin (FCM push).

---

## Entry Point & Process Roles

**`src/index.ts`** resolves `SFM_PROCESS_ROLE` to determine what the container runs:

| Role            | HTTP Server | Queue Workers | Alert Automation |
| --------------- | :---------: | :-----------: | :--------------: |
| `all` (default) |      ✓      |       ✓       |        ✓         |
| `api`           |      ✓      |       —       |        —         |
| `worker`        |      —      |       ✓       |        ✓         |

Docker Compose runs two containers from the same image — one with `api`, one with `worker`.

Graceful shutdown handles `SIGINT`/`SIGTERM`, drains queues, and closes DB connections.

---

## Middleware Stack

Applied in order in **`src/app.ts`**:

1. **Request logging** (dev only) — URL sanitization for sensitive paths
2. **CORS** — configurable origins via `CORS_ORIGINS`, credentials enabled
3. **Global rate limit** — 100 req/min per IP
4. **Auth rate limit** — 10 req/min on `/api/auth/*`

Additional per-route limiters: STK push (5/min), SMS (10/min), applications (10/min), M-Pesa callbacks (1000/min).

---

## Authentication & Authorization

### Admin Staff (Better Auth)

- Session-based via Better Auth at `/api/auth/*`
- `requireAuth` middleware validates session, attaches user to context
- `requirePermission("resource:action")` enforces RBAC

### 25+ Permission Types

| Permission                                                                                 | Description                                       |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `meters:read` / `meters:write` / `meters:status`                                           | Meter CRUD and status changes                     |
| `tariffs:read` / `tariffs:manage`                                                          | Tariff viewing and management                     |
| `transactions:read` / `transactions:summary` / `transactions:resend_token`                 | Transaction operations                            |
| `sms:read` / `sms:resend` / `sms:test`                                                     | SMS log access and actions                        |
| `applications:read` / `applications:decide`                                                | Meter application workflow                        |
| `users:manage`                                                                             | User CRUD, banning, password, sessions            |
| `audit_logs:read`                                                                          | Audit log access                                  |
| `admin_tokens:create`                                                                      | Generate admin tokens (tamper, power, key change) |
| `mother_meters:read` / `mother_meters:events:create` / `mother_meters:reconciliation:read` | Mother meter ops                                  |
| `mother_meter_alerts:manage`                                                               | Low-balance and postpaid reminder alerts          |
| `notifications:manage`                                                                     | Admin notification management                     |
| `failed_transactions:manage`                                                               | Failed transaction review                         |
| `app_notifications:manage`                                                                 | Customer push notification management             |
| `customer_prompts:manage`                                                                  | Customer prompt queuing                           |
| `support_recovery:read`                                                                    | Support recovery lookup                           |
| `provider_ops:gomelong`                                                                    | Direct Gomelong provider access                   |
| `system:diagnostics:read`                                                                  | Health check details                              |

### Landlord Mobile Access

- OTP-based auth (`/send-otp` → `/verify-otp`) via SMS
- 64-char hex access token, SHA-256 hashed in DB
- `requireLandlordAccess` middleware validates token + loads landlord context

### Tenant Mobile Access

- Bootstrap via sub-meter serial number (`/bootstrap`)
- Same token scheme as landlord
- `requireTenantAccess` middleware validates token + loads tenant context

---

## API Routes

### Infrastructure

| Method | Path                   | Auth                      | Description                  |
| ------ | ---------------------- | ------------------------- | ---------------------------- |
| GET    | `/`                    | —                         | Service info (name, version) |
| GET    | `/api/health`          | —                         | Basic health check           |
| GET    | `/api/health/detailed` | `system:diagnostics:read` | DB + queue diagnostics       |
| GET    | `/api/health/queues`   | `system:diagnostics:read` | Queue health only            |

### Meters (`/api/meters`)

| Method | Path                   | Auth            | Description                                    |
| ------ | ---------------------- | --------------- | ---------------------------------------------- |
| GET    | `/`                    | `meters:read`   | List meters (filter by status, motherMeterId)  |
| GET    | `/:id`                 | `meters:read`   | Get meter with relationships                   |
| GET    | `/lookup/:meterNumber` | `meters:read`   | Lookup by meter number                         |
| POST   | `/`                    | `meters:write`  | Create meter (validates tariff + mother meter) |
| PATCH  | `/:id`                 | `meters:write`  | Update meter                                   |
| POST   | `/:id/suspend`         | `meters:status` | Suspend meter (queues tenant alert)            |
| POST   | `/:id/activate`        | `meters:status` | Reactivate meter (queues tenant alert)         |

### Tariffs (`/api/tariffs`)

| Method | Path          | Auth             | Description                          |
| ------ | ------------- | ---------------- | ------------------------------------ |
| GET    | `/`           | `tariffs:read`   | List active tariffs                  |
| GET    | `/all`        | `tariffs:manage` | List all tariffs (including expired) |
| GET    | `/:id`        | `tariffs:read`   | Get single tariff                    |
| POST   | `/`           | `tariffs:manage` | Create tariff                        |
| PATCH  | `/:id`        | `tariffs:manage` | Update tariff                        |
| POST   | `/:id/expire` | `tariffs:manage` | Expire tariff immediately            |

### Transactions (`/api/transactions`)

| Method | Path                        | Auth                        | Description                                          |
| ------ | --------------------------- | --------------------------- | ---------------------------------------------------- |
| GET    | `/`                         | `transactions:read`         | List with filters (meter, phone, status, date range) |
| GET    | `/:id`                      | `transactions:read`         | Get details (tokens, SMS logs, M-Pesa ref)           |
| GET    | `/reference/:transactionId` | `transactions:read`         | Lookup by OHM-xxx reference                          |
| POST   | `/resend-token`             | `transactions:resend_token` | Queue token SMS resend                               |
| GET    | `/stats/summary`            | `transactions:summary`      | Aggregate statistics                                 |

### M-Pesa (`/api/mpesa`)

| Method | Path                                 | Auth                       | Description               |
| ------ | ------------------------------------ | -------------------------- | ------------------------- |
| POST   | `/stk-push`                          | `requireAuth` + rate limit | Initiate STK push prompt  |
| POST   | `/stk-push/callback`                 | Source validation          | STK push callback handler |
| GET    | `/stk-push/query/:checkoutRequestId` | `requireAuth`              | Query STK status          |
| POST   | `/validation`                        | Source validation          | C2B validation endpoint   |
| POST   | `/callback`                          | Source validation          | C2B payment callback      |
| GET    | `/health`                            | `mpesa:health:read`        | M-Pesa integration health |

### SMS (`/api/sms`)

| Method | Path               | Auth         | Description               |
| ------ | ------------------ | ------------ | ------------------------- |
| GET    | `/`                | `sms:read`   | List SMS logs (paginated) |
| GET    | `/provider-health` | `sms:read`   | Provider health summary   |
| GET    | `/:id`             | `sms:read`   | Get single SMS log        |
| POST   | `/resend/:id`      | `sms:resend` | Retry SMS delivery        |
| POST   | `/test`            | `sms:test`   | Send test SMS             |

### SMS Recovery (`/api/sms/recovery`)

| Method | Path               | Auth         | Description                        |
| ------ | ------------------ | ------------ | ---------------------------------- |
| GET    | `/`                | `sms:read`   | List recovery entries              |
| POST   | `/:id/sync-status` | `sms:read`   | Sync delivery status from provider |
| POST   | `/:id/retry`       | `sms:resend` | Retry single failed SMS            |
| POST   | `/retry-batch`     | `sms:resend` | Batch retry                        |

### SMS Webhooks (`/api/sms/webhooks`)

| Method   | Path                | Auth          | Description                  |
| -------- | ------------------- | ------------- | ---------------------------- |
| GET/POST | `/hostpinnacle/dlr` | Webhook token | HostPinnacle delivery report |

### Applications (`/api/applications`)

| Method | Path           | Auth                  | Description                    |
| ------ | -------------- | --------------------- | ------------------------------ |
| POST   | `/`            | Rate limit (public)   | Submit meter application       |
| GET    | `/`            | `applications:read`   | List applications              |
| GET    | `/:id`         | `applications:read`   | Get application details        |
| POST   | `/:id/approve` | `applications:decide` | Approve → creates meters + SMS |
| POST   | `/:id/reject`  | `applications:decide` | Reject application             |

### Mother Meters (`/api/mother-meters`)

| Method | Path                                | Auth                                | Description                          |
| ------ | ----------------------------------- | ----------------------------------- | ------------------------------------ |
| GET    | `/`                                 | `mother_meters:read`                | List with landlord, tariff, property |
| GET    | `/:id/events`                       | `mother_meters:read`                | Event history (deposits, refills)    |
| POST   | `/:id/events`                       | `mother_meters:events:create`       | Record new event                     |
| GET    | `/:id/balance`                      | `mother_meters:read`                | Current balance (real-time calc)     |
| GET    | `/:id/reconciliation`               | `mother_meters:reconciliation:read` | Net sales vs KPLC payments           |
| GET    | `/alerts/low-balance`               | `mother_meter_alerts:manage`        | Low balance alerts                   |
| POST   | `/alerts/low-balance/notify`        | `mother_meter_alerts:manage`        | Generate low-balance notifications   |
| GET    | `/alerts/postpaid-reminders`        | `mother_meter_alerts:manage`        | Postpaid reminders                   |
| POST   | `/alerts/postpaid-reminders/notify` | `mother_meter_alerts:manage`        | Generate reminder notifications      |

### Admin Tokens (`/api/admin-tokens`)

| Method | Path | Auth                  | Description                                              |
| ------ | ---- | --------------------- | -------------------------------------------------------- |
| POST   | `/`  | `admin_tokens:create` | Generate admin token (credit, tamper, power, key change) |

### Users (`/api/users`)

| Method | Path                                  | Auth           | Description            |
| ------ | ------------------------------------- | -------------- | ---------------------- |
| GET    | `/`                                   | `users:manage` | List users             |
| GET    | `/:userId`                            | `users:manage` | Get user               |
| POST   | `/`                                   | `users:manage` | Create user            |
| PATCH  | `/:userId`                            | `users:manage` | Update user            |
| POST   | `/:userId/role`                       | `users:manage` | Set role               |
| POST   | `/:userId/ban`                        | `users:manage` | Ban (revokes sessions) |
| POST   | `/:userId/unban`                      | `users:manage` | Unban                  |
| POST   | `/:userId/password`                   | `users:manage` | Set password           |
| GET    | `/:userId/sessions`                   | `users:manage` | List sessions          |
| POST   | `/:userId/sessions/revoke-all`        | `users:manage` | Revoke all sessions    |
| POST   | `/:userId/sessions/:sessionId/revoke` | `users:manage` | Revoke session         |

### Notifications (`/api/notifications`)

| Method | Path                       | Auth                   | Description               |
| ------ | -------------------------- | ---------------------- | ------------------------- |
| GET    | `/`                        | `notifications:manage` | List admin notifications  |
| PATCH  | `/:id/read`                | `notifications:manage` | Mark as read              |
| POST   | `/read-all`                | `notifications:manage` | Mark all read             |
| POST   | `/run-alert-checks`        | `notifications:manage` | Manual alert check        |
| POST   | `/run-sms-provider-alerts` | `notifications:manage` | Manual SMS provider check |
| POST   | `/run-daily-usage-sms`     | `notifications:manage` | Manual daily usage SMS    |

### Failed Transactions (`/api/failed-transactions`)

| Method | Path          | Auth                         | Description                              |
| ------ | ------------- | ---------------------------- | ---------------------------------------- |
| GET    | `/`           | `failed_transactions:manage` | List failures (filter by status, reason) |
| PATCH  | `/:id/status` | `failed_transactions:manage` | Update resolution status                 |

### Audit Logs (`/api/audit-logs`)

| Method | Path   | Auth              | Description          |
| ------ | ------ | ----------------- | -------------------- |
| GET    | `/`    | `audit_logs:read` | List audit logs      |
| GET    | `/:id` | `audit_logs:read` | Get single audit log |

### Auth Security (`/api/auth-security`)

| Method | Path                       | Auth          | Description                        |
| ------ | -------------------------- | ------------- | ---------------------------------- |
| GET    | `/profile`                 | `requireAuth` | Current user's 2FA profile         |
| POST   | `/totp-prompt/acknowledge` | `requireAuth` | Acknowledge TOTP enrollment prompt |
| POST   | `/preferred-method`        | `requireAuth` | Update preferred 2FA method        |

### Customer Prompts (`/api/customer-prompts`)

| Method | Path     | Auth                      | Description                  |
| ------ | -------- | ------------------------- | ---------------------------- |
| GET    | `/`      | `customer_prompts:manage` | List prompt candidates       |
| POST   | `/queue` | `customer_prompts:manage` | Queue prompts for recipients |

### App Notifications (`/api/app-notifications`)

| Method | Path                 | Auth                       | Description                      |
| ------ | -------------------- | -------------------------- | -------------------------------- |
| GET    | `/`                  | `app_notifications:manage` | List customer push notifications |
| POST   | `/:id/requeue`       | `app_notifications:manage` | Requeue failed notification      |
| GET    | `/device-tokens`     | `app_notifications:manage` | List device tokens               |
| POST   | `/device-tokens`     | `app_notifications:manage` | Upsert device token              |
| DELETE | `/device-tokens/:id` | `app_notifications:manage` | Deactivate token                 |

### Support Recovery (`/api/support-recovery`)

| Method | Path | Auth                    | Description              |
| ------ | ---- | ----------------------- | ------------------------ |
| GET    | `/`  | `support_recovery:read` | Meter lookup for support |

### Gomelong Provider (`/api/gomelong`)

| Method                | Path                          | Auth                    | Description                  |
| --------------------- | ----------------------------- | ----------------------- | ---------------------------- |
| GET                   | `/health`                     | `provider_ops:gomelong` | Provider health              |
| GET                   | `/kmf/sgc`                    | `provider_ops:gomelong` | List SGC codes by meter type |
| GET                   | `/power/vending-token`        | `provider_ops:gomelong` | Generate vending token       |
| GET                   | `/power/clear-tamper-token`   | `provider_ops:gomelong` | Generate clear tamper token  |
| GET                   | `/power/clear-credit-token`   | `provider_ops:gomelong` | Generate clear credit token  |
| GET                   | `/power/change-decoder-token` | `provider_ops:gomelong` | Decoder change token         |
| GET                   | `/power/max-power-token`      | `provider_ops:gomelong` | Max power token              |
| GET                   | `/power/contract-info`        | `provider_ops:gomelong` | Meter contract info          |
| POST                  | `/power/meter-register`       | `provider_ops:gomelong` | Register meter               |
| POST                  | `/power/meter-update`         | `provider_ops:gomelong` | Update meter                 |
| POST                  | `/power/meter-delete`         | `provider_ops:gomelong` | Delete meter                 |
| GET/POST/PATCH/DELETE | `/use-types`                  | `provider_ops:gomelong` | CRUD use types               |
| POST                  | `/water-vend/page`            | `provider_ops:gomelong` | Water vending data           |

### Landlord Mobile (`/api/mobile/landlord-access`)

| Method | Path                                       | Auth           | Description                 |
| ------ | ------------------------------------------ | -------------- | --------------------------- |
| POST   | `/send-otp`                                | Rate limit     | Send OTP SMS                |
| POST   | `/verify-otp`                              | Rate limit     | Verify OTP → access token   |
| GET    | `/me`                                      | Landlord token | Identity + access info      |
| GET    | `/summary`                                 | Landlord token | Dashboard summary           |
| GET    | `/mother-meters`                           | Landlord token | List mother meters          |
| GET    | `/mother-meters/:id`                       | Landlord token | Mother meter details        |
| GET    | `/mother-meters/:id/timeline`              | Landlord token | Transaction timeline        |
| GET    | `/mother-meters/:id/daily-rollups`         | Landlord token | Daily aggregated usage      |
| GET    | `/sub-meters/:id`                          | Landlord token | Sub-meter details           |
| GET    | `/sub-meters/:id/timeline`                 | Landlord token | Sub-meter timeline          |
| GET    | `/sub-meters/:id/daily-rollups`            | Landlord token | Sub-meter rollups           |
| GET    | `/purchases`                               | Landlord token | All purchases (paginated)   |
| GET    | `/activity`                                | Landlord token | Activity feed               |
| GET    | `/usage-history`                           | Landlord token | Usage history breakdown     |
| GET    | `/timeline`                                | Landlord token | Overall timeline            |
| GET    | `/notifications`                           | Landlord token | Landlord notifications      |
| POST   | `/device-tokens`                           | Landlord token | Upsert device token         |
| GET    | `/properties/:id/analytics-summary`        | Landlord token | Property analytics          |
| GET    | `/properties/:id/rollups`                  | Landlord token | Property rollups            |
| GET    | `/properties/:id/mother-meter-comparisons` | Landlord token | Compare meters              |
| GET    | `/thresholds/summary`                      | Landlord token | Threshold status            |
| GET    | `/thresholds/mother-meters`                | Landlord token | Meters with thresholds      |
| GET    | `/thresholds/mother-meters/:id/history`    | Landlord token | Threshold history           |
| GET    | `/exceptional-state/summary`               | Landlord token | Exceptional state summary   |
| GET    | `/exceptional-state/mother-meters`         | Landlord token | Meters in exceptional state |

### Tenant Mobile (`/api/mobile/tenant-access`)

| Method | Path                                           | Auth         | Description                        |
| ------ | ---------------------------------------------- | ------------ | ---------------------------------- |
| POST   | `/bootstrap`                                   | Rate limit   | Bootstrap via meter serial         |
| GET    | `/me`                                          | Tenant token | Identity + access info             |
| GET    | `/summary`                                     | Tenant token | Dashboard summary (units, balance) |
| GET    | `/history-summary`                             | Tenant token | Historical usage                   |
| GET    | `/exceptional-state`                           | Tenant token | Meter exceptional state            |
| GET    | `/recovery-states`                             | Tenant token | Recovery history                   |
| GET    | `/purchases`                                   | Tenant token | Purchase list                      |
| GET    | `/purchase-rollups`                            | Tenant token | Aggregated purchase data           |
| GET    | `/token-deliveries`                            | Tenant token | Token delivery events              |
| GET    | `/token-deliveries/:transactionId`             | Tenant token | Single delivery details            |
| POST   | `/token-deliveries/:transactionId/acknowledge` | Tenant token | Mark as read                       |
| GET    | `/notifications`                               | Tenant token | Tenant notifications               |
| POST   | `/device-tokens`                               | Tenant token | Upsert device token                |
| POST   | `/notifications/:id/read`                      | Tenant token | Mark notification as read          |

---

## Database Schema

### Entity Relationship Diagram

```
customers ──1:M──▶ properties ──1:M──▶ mother_meters ──1:M──▶ meters
    │                                       │                    │
    │                                       │                    ├──1:M──▶ transactions ──1:M──▶ generated_tokens
    │                                       │                    │              │
    │                                       │                    │              └──1:M──▶ sms_logs
    │                                       │                    │
    │                                       │                    └──1:M──▶ tenant_app_accesses
    │                                       │
    │                                       └──1:M──▶ mother_meter_events
    │
    └───────────── tariffs ◀── meters, mother_meters

mpesa_transactions ──1:M──▶ transactions
                   ──1:M──▶ failed_transactions

meter_applications (standalone onboarding)
audit_logs (standalone audit trail)
admin_notifications (standalone alerts)
customer_app_notifications (push notifications)
customer_device_tokens (FCM tokens)
```

### Tables

#### `customers`

| Column       | Type        | Notes                     |
| ------------ | ----------- | ------------------------- |
| id           | UUID PK     |                           |
| userId       | TEXT        | Better Auth user ID       |
| phoneNumber  | TEXT UNIQUE | Primary M-Pesa identifier |
| name         | TEXT        |                           |
| customerType | ENUM        | `tenant`, `landlord`      |
| createdAt    | TIMESTAMP   |                           |

#### `properties`

| Column        | Type                | Notes |
| ------------- | ------------------- | ----- |
| id            | UUID PK             |       |
| landlordId    | UUID FK → customers |       |
| name          | TEXT                |       |
| location      | TEXT                |       |
| numberOfUnits | INTEGER             |       |
| createdAt     | TIMESTAMP           |       |

#### `tariffs`

| Column     | Type          | Notes                      |
| ---------- | ------------- | -------------------------- |
| id         | UUID PK       |                            |
| name       | TEXT          | e.g. "Domestic Step 1"     |
| ratePerKwh | NUMERIC(10,4) | KES per kWh                |
| currency   | TEXT          | Default `KES`              |
| validFrom  | TIMESTAMP     |                            |
| validTo    | TIMESTAMP     | Nullable for current rates |

#### `mother_meters`

| Column              | Type                 | Notes                     |
| ------------------- | -------------------- | ------------------------- |
| id                  | UUID PK              |                           |
| motherMeterNumber   | TEXT UNIQUE          | KPLC meter number         |
| type                | ENUM                 | `prepaid`, `postpaid`     |
| landlordId          | UUID FK → customers  |                           |
| tariffId            | UUID FK → tariffs    |                           |
| propertyId          | UUID FK → properties |                           |
| totalCapacity       | NUMERIC              | kW, nullable              |
| lowBalanceThreshold | NUMERIC(10,2)        | Default 1000 KES          |
| billingPeriodStart  | INTEGER              | Day of month for postpaid |

#### `mother_meter_events`

| Column            | Type          | Notes                                       |
| ----------------- | ------------- | ------------------------------------------- |
| id                | UUID PK       |                                             |
| motherMeterId     | UUID FK       |                                             |
| eventType         | ENUM          | `initial_deposit`, `refill`, `bill_payment` |
| amount            | NUMERIC(12,2) | KES paid to KPLC                            |
| kplcToken         | TEXT          | Prepaid refill token (nullable)             |
| kplcReceiptNumber | TEXT          | KPLC reference                              |
| performedBy       | UUID          | Admin user                                  |

#### `meters` (Sub-meters)

| Column            | Type        | Notes                             |
| ----------------- | ----------- | --------------------------------- |
| id                | UUID PK     |                                   |
| meterNumber       | TEXT UNIQUE | Customer-facing number            |
| meterType         | ENUM        | `electricity`, `water`, `gas`     |
| brand             | ENUM        | `hexing`, `stron`, `conlog`       |
| motherMeterId     | UUID FK     | NOT NULL                          |
| tariffId          | UUID FK     | NOT NULL                          |
| supplyGroupCode   | TEXT        | SGC, critical for STS generation  |
| keyRevisionNumber | INTEGER     | 1 or 2, default 1                 |
| tariffIndex       | INTEGER     | Default 1                         |
| status            | ENUM        | `active`, `inactive`, `suspended` |

#### `transactions`

| Column             | Type               | Notes                                          |
| ------------------ | ------------------ | ---------------------------------------------- |
| id                 | UUID PK            |                                                |
| transactionId      | TEXT UNIQUE        | OHM-xxx format                                 |
| meterId            | UUID FK → meters   |                                                |
| mpesaTransactionId | UUID FK (nullable) |                                                |
| phoneNumber        | TEXT               | Customer phone                                 |
| mpesaReceiptNumber | TEXT UNIQUE        | Idempotency key                                |
| amountPaid         | NUMERIC(12,2)      | Gross from customer                            |
| commissionAmount   | NUMERIC(12,2)      | 10% fee                                        |
| netAmount          | NUMERIC(12,2)      | 90% to landlord/utility                        |
| rateUsed           | NUMERIC(10,4)      | Tariff rate snapshot                           |
| unitsPurchased     | NUMERIC(12,4)      | netAmount / rateUsed                           |
| status             | ENUM               | `pending`, `processing`, `completed`, `failed` |
| paymentMethod      | ENUM               | `paybill`, `stk_push`                          |

#### `generated_tokens`

| Column        | Type               | Notes                                                                     |
| ------------- | ------------------ | ------------------------------------------------------------------------- |
| id            | UUID PK            |                                                                           |
| meterId       | UUID FK            |                                                                           |
| transactionId | UUID FK (nullable) |                                                                           |
| token         | TEXT               | 20-digit STS token, **AES-256-GCM encrypted**                             |
| tokenType     | ENUM               | `credit`, `clear_tamper`, `set_power_limit`, `key_change`, `clear_credit` |
| value         | NUMERIC(12,4)      | kWh for credit, null for others                                           |
| generatedBy   | ENUM               | `system`, `admin`, `landlord`                                             |

#### `mpesa_transactions`

| Column        | Type          | Notes                                                      |
| ------------- | ------------- | ---------------------------------------------------------- |
| id            | UUID PK       |                                                            |
| transId       | TEXT UNIQUE   | M-Pesa receipt, idempotency key                            |
| transAmount   | NUMERIC(12,2) |                                                            |
| billRefNumber | TEXT          | Meter number entered by user                               |
| msisdn        | TEXT          | Phone number                                               |
| status        | ENUM          | `pending`, `received`, `processing`, `completed`, `failed` |
| rawPayload    | JSONB         | Full original callback JSON                                |

#### `sms_logs`

| Column            | Type               | Notes                                   |
| ----------------- | ------------------ | --------------------------------------- |
| id                | UUID PK            |                                         |
| transactionId     | UUID FK (nullable) |                                         |
| phoneNumber       | TEXT               |                                         |
| messageBody       | TEXT               | Redacted in API responses               |
| provider          | ENUM               | `hostpinnacle`, `textsms`               |
| status            | ENUM               | `queued`, `sent`, `delivered`, `failed` |
| providerMessageId | TEXT               | External ID for DLR                     |
| cost              | NUMERIC(8,4)       |                                         |

#### `failed_transactions`

| Column             | Type    | Notes                                                                                           |
| ------------------ | ------- | ----------------------------------------------------------------------------------------------- |
| id                 | UUID PK |                                                                                                 |
| mpesaTransactionId | UUID FK | NOT NULL                                                                                        |
| failureReason      | ENUM    | `invalid_meter`, `below_minimum`, `manufacturer_error`, `sms_failed`, `meter_inactive`, `other` |
| status             | ENUM    | `pending_review`, `refunded`, `resolved`, `abandoned`                                           |

#### `meter_applications`

Full onboarding form: personal info, property details, meter numbers, installation type, technician info, terms acceptance. Status: `pending` → `approved` / `rejected`.

#### `tenant_app_accesses`

| Column          | Type        | Notes                   |
| --------------- | ----------- | ----------------------- |
| id              | UUID PK     |                         |
| meterId         | UUID FK     |                         |
| accessTokenHash | TEXT UNIQUE | SHA-256 of access token |
| status          | ENUM        | `active`, `revoked`     |

#### `customer_app_notifications`

Push notifications for landlords/tenants: type, status (`pending`/`sent`/`read`/`failed`), title, message, metadata, delivery attempts.

#### `customer_device_tokens`

FCM/APNs tokens: platform (`android`/`ios`/`web`), linked to landlord or tenant access, auto-invalidated on permanent FCM failure.

#### `admin_notifications`

Admin alerts: types include `mother_meter_low_balance`, `postpaid_payment_reminder`, `daily_usage_summary`, `sms_provider_outage`. Severity: `info`/`warning`/`critical`.

#### `audit_logs`

Every admin action: userId, action name, entityType, entityId, details (JSONB with before/after), IP address.

---

## Job Queues

Four BullMQ queues backed by Redis:

### 1. PAYMENT_PROCESSING (concurrency: 3)

**Trigger**: M-Pesa callback (C2B or STK push)

**Flow**:

1. Validate payment (meter exists, active, minimum amount)
2. Create transaction record with commission calculation
3. Queue token generation → TOKEN_GENERATION
4. Queue tenant/landlord notifications
5. On failure → create `failed_transactions` entry with reason code

### 2. TOKEN_GENERATION (concurrency: 5)

**Trigger**: Successful payment processing

**Flow**:

1. Fetch meter details (SGC, key revision, tariff index)
2. Call Gomelong API for STS vending token
3. Encrypt token (AES-256-GCM) and store in `generated_tokens`
4. Queue SMS delivery → SMS_DELIVERY
5. Queue tenant app notification → APP_NOTIFICATION_DELIVERY
6. Mark transaction as `completed`

### 3. SMS_DELIVERY (concurrency: 10)

**Trigger**: Token generation, admin actions, notifications, prompts

**Flow**:

1. Format SMS message (token in 4-digit groups, with amount/units)
2. Send via HostPinnacle (primary provider)
3. On failure → fallback to TextSMS
4. Log to `sms_logs` with provider details
5. DLR updates arrive via webhook asynchronously

### 4. APP_NOTIFICATION_DELIVERY (concurrency: 5)

**Trigger**: Token delivery, meter status change, low balance

**Flow**:

1. Look up active device tokens for recipient
2. Send FCM multicast
3. Handle permanent failures (invalidate device tokens)
4. Update notification status

**Retry policy**: 3 attempts, exponential backoff (1s → 2s → 4s).
**Retention**: Completed jobs kept 24h (max 1000), failed jobs kept 7 days.

---

## Services Layer

~90 service files organized by domain:

| Domain              | Key Services                                                                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Payments**        | `mpesa.service`, `payment.processor`, `token.processor`                                                                                                                                                                                                           |
| **SMS**             | `sms.service`, `sms-recovery.service`, `sms-provider-health.service`, `sms-dlr.service`, `textsms-dlr.service`                                                                                                                                                    |
| **Meters**          | `landlord-sub-meter.service`, `mother-meter-analytics.service`, `mother-meter-alerts.service`                                                                                                                                                                     |
| **Landlord Mobile** | `landlord-access.service`, `landlord-dashboard.service`, `landlord-history.service`, `landlord-timeline.service`, `landlord-activity.service`, `landlord-property-analytics-summary.service`, `landlord-thresholds.service`, `landlord-exceptional-state.service` |
| **Tenant Mobile**   | `tenant-access.service`, `tenant-dashboard.service`, `tenant-history-summary.service`, `tenant-token-delivery.service`, `tenant-purchase-rollups.service`, `tenant-exceptional-state.service`, `tenant-recovery-state.service`                                    |
| **Notifications**   | `app-notifications.service`, `landlord-notification-producer.service`, `tenant-notification-producer.service`, `admin-notifications.service`, `customer-device-tokens.service`                                                                                    |
| **Automation**      | `alert-automation.service`, `daily-usage-sms.service`, `sms-provider-alerts.service`                                                                                                                                                                              |
| **Admin**           | `admin-token-operations.service`, `audit-log.service`, `user-management.service`, `auth-security.service`                                                                                                                                                         |
| **Onboarding**      | `application-onboarding.service`, `customer-prompts.service`                                                                                                                                                                                                      |
| **Provider**        | `meter-providers/gomelong`                                                                                                                                                                                                                                        |

---

## SMS Delivery

**Dual-provider architecture** with automatic failover:

| Provider         | Role     | Delivery Reports                                   |
| ---------------- | -------- | -------------------------------------------------- |
| **HostPinnacle** | Primary  | Via webhook (`/api/sms/webhooks/hostpinnacle/dlr`) |
| **TextSMS**      | Fallback | Via API polling (sync)                             |

**SMS Types**: Token delivery (credit purchases), admin token delivery, onboarding approval, failure notifications, low-balance nudges, daily usage summaries, customer prompts.

**Token formatting**: 20-digit tokens split into 4-digit groups with amount, units, and local-timezone date.

**Redaction**: All token digits masked in API responses (last 4 shown). Phone numbers and meter numbers partially masked in logs.

---

## Mobile Access (Landlord & Tenant)

### Domain Model

- **Landlord** = the registered app user who owns the mother meter
- **Tenant** = transactional access via sub-meter serial number (not an account owner)
- These are separate auth flows and separate middleware chains

### Landlord Flow

1. `POST /send-otp` — SMS one-time password
2. `POST /verify-otp` — Returns 64-char hex access token
3. All subsequent requests use `Authorization: Bearer <token>`
4. Scoped to landlord's properties, mother meters, and sub-meters

### Tenant Flow

1. `POST /bootstrap` — Enter sub-meter serial number
2. Returns access token scoped to that meter only
3. Can view purchases, token deliveries, notifications
4. Cannot manage meters or see other tenants' data

---

## Configuration & Environment

### Always Required

| Variable       | Description                  |
| -------------- | ---------------------------- |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL`    | Redis connection string      |

### Application

| Variable           | Default       | Description                     |
| ------------------ | ------------- | ------------------------------- |
| `NODE_ENV`         | `development` |                                 |
| `PORT`             | `3000`        |                                 |
| `SFM_PROCESS_ROLE` | `all`         | `api`, `worker`, or `all`       |
| `CORS_ORIGINS`     | —             | Comma-separated allowed origins |

### M-Pesa

`MPESA_SHORTCODE`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_ENVIRONMENT`, `MPESA_BASE_URL`, `MPESA_CALLBACK_URL`, `MPESA_REGISTER_TOKEN`, `MPESA_CALLBACK_TOKEN`, `MPESA_CALLBACK_TOKEN_TRANSPORT` (query/header/both), `MPESA_SIGNATURE_SECRET`, `MPESA_SIGNATURE_HEADER`, `MPESA_SIGNATURE_TIMESTAMP_HEADER`, `MPESA_SIGNATURE_MAX_AGE_SECONDS`, `MPESA_REQUIRE_SIGNATURE`, `MPESA_C2B_COMMAND_ID`, `MPESA_TRANSACTION_STATUS_COMMAND_ID`, `MPESA_IDENTIFIER_TYPE`, `MPESA_ALLOWED_IPS`

### Auth

`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`

### Firebase / FCM

`FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_PATH`, `FCM_ENABLED`, `FCM_DRY_RUN`

### SMS Providers

**HostPinnacle**: `HOSTPINNACLE_API_URL`, `HOSTPINNACLE_USER_ID`, `HOSTPINNACLE_PASSWORD`, `HOSTPINNACLE_API_KEY`, `HOSTPINNACLE_SENDER_ID`, `HOSTPINNACLE_DLR_WEBHOOK_TOKEN`, `HOSTPINNACLE_DLR_WEBHOOK_HEADER`

**TextSMS**: `TEXTSMS_API_URL`, `TEXTSMS_BULK_API_URL`, `TEXTSMS_DLR_API_URL`, `TEXTSMS_BALANCE_API_URL`, `TEXTSMS_PARTNER_ID`, `TEXTSMS_API_KEY`, `TEXTSMS_SENDER_ID`, `TEXTSMS_PASS_TYPE`

### Gomelong (STS Token Provider)

`GOMELONG_API_URL`, `GOMELONG_USER_ID`, `GOMELONG_PASSWORD`, `GOMELONG_VENDING_TYPE`

### Alerts & Automation

`ALERT_AUTOMATION_ENABLED` (default false), `ALERT_AUTOMATION_INTERVAL_SECONDS` (default 900), `ALERT_TIMEZONE` (default Africa/Nairobi), `LOW_BALANCE_ALERT_DEDUPE_HOURS`, `POSTPAID_REMINDER_DEDUPE_HOURS`, `POSTPAID_REMINDER_DAYS_AFTER_PAYMENT`, `LANDLORD_DAILY_USAGE_SMS_ENABLED`, `LANDLORD_DAILY_USAGE_SMS_HOUR` (default 20 = 8 PM)

### Business Rules (Hardcoded)

| Rule                  | Value       |
| --------------------- | ----------- |
| Commission rate       | 10%         |
| Minimum transaction   | KES 30      |
| Token encryption      | AES-256-GCM |
| Rate limit (global)   | 100 req/min |
| Rate limit (auth)     | 10 req/min  |
| Rate limit (STK push) | 5 req/min   |

---

## Key Patterns

### Money Math

All financial calculations use fixed-decimal BigInt arithmetic via `money.ts` — no floating-point rounding errors. KES amounts use 2 decimals, rates use 4, units use 4.

### Token Security

STS tokens encrypted with AES-256-GCM at rest (format: `enc:v1:iv:ciphertext:authTag`). Masked in all API responses. Full token only sent via SMS.

### Idempotency

- M-Pesa callbacks: keyed by `transId` (receipt number)
- Job processing: BullMQ job IDs prevent duplicate processing
- SMS resends: keyed by smsLogId

### Audit Trail

Every admin mutation logged to `audit_logs` with: user ID, action, entity type/ID, before/after JSON details, client IP.

### Rate Limiting

Redis-backed sliding window with Lua atomicity. Falls back to in-memory store (60s TTL) if Redis is unavailable. Six profiles for different endpoint types.

### Notification Producers

Landlord and tenant notification producers queue push notifications without direct DB writes — deduplication and batching handled by the queue processors.
