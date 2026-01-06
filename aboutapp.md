# Technical Project Overview: OHMKenya (December 2025)

## Project Identity

**Name:** OHMKenya
**Type:** Prepaid utility metering platform (electricity, water, gas)
**Architecture:** Monorepo with separate backend API and frontend web application
**Business Model:** 10% commission on all token purchases
**Primary Market:** Landlords managing rental properties (residential and commercial) in Kenya
**Target Scale:** 100,000 transactions per day

---

## Current Technology Stack (December 2025 Stable Versions)

### Backend Stack

**Runtime:** Bun

- Modern JavaScript runtime, faster than Node.js
- Native TypeScript execution
- Built-in package manager, bundler, test runner

**Authentication:** Better-Auth

- Comprehensive auth library for TypeScript
- Supports multiple providers (Email/Password, OAuth)
- Built-in session management and RBAC (Role-Based Access Control)

**API Framework:** Elysia

- High-performance web framework built for Bun
- Benchmarked at 2.4M requests/second
- End-to-end type safety with TypeScript

**Database:** PostgreSQL

- Running in Docker for local development
- Production: Cloud provider TBD

**ORM:** Drizzle ORM

- Lightweight with SQL-like syntax
- Full TypeScript inference

**Caching:** Redis

- Docker for local development
- Production: Upstash Redis (serverless)

**Message Queue:** BullMQ

- Redis-based queue for asynchronous processing

### Frontend Stack

**Framework:** Next.js 16

- React 19 support
- Server-side rendering
- Turbopack for development

**Monorepo:** Turborepo

- Workspace-based organization
- Shared types between frontend/backend

---

## Current Payment Flow (Phase 1 Implementation)

### Paybill Model (Current Implementation)

**How It Works:**

**User Journey:**

1. Customer goes to M-Pesa on their phone
2. Selects Lipa na M-Pesa → Pay Bill
3. Enters OHMKenya's paybill number
4. Enters their meter number as the account number
5. Enters amount they want to purchase
6. Confirms transaction with PIN
7. M-Pesa processes payment
8. OHMKenya API receives M-Pesa callback notification
9. System validates meter number exists
10. System calculates units based on KPLC rate for that meter
11. System calls manufacturer API to generate token
12. System sends SMS with token to the phone number that made payment
13. Customer receives SMS with 20-digit token
14. Customer enters token on their physical meter
15. Meter credits units

**Technical Implementation:**

**M-Pesa C2B (Customer to Business) API:**

- Register paybill number with M-Pesa
- Configure callback URLs for payment notifications
- Receive real-time callbacks when payments are made
- Extract: phone number, amount, account number (meter number), transaction reference

**Callback Processing:**

- Webhook endpoint receives M-Pesa callback
- Validates transaction signature
- Extracts meter number from account number field
- Queues job for processing (never block M-Pesa callback response)
- Returns 200 OK immediately to M-Pesa

**Background Job Processing:**

- Validate meter number exists in database
- Retrieve meter's KPLC rate
- Calculate units: amount divided by rate per kWh
- Apply OHMKenya's 10% commission
- Call manufacturer API with calculated units
- Receive 20-digit token from manufacturer
- Queue SMS delivery job
- Update transaction record in database

**Offline Mode Support:**

- System works even when customer has no internet
- Customer only needs basic M-Pesa access
- No app or web access required
- Payment and token delivery happen asynchronously

---

## Future Payment Flow (Phase 2)

### STK Push Model (Future Enhancement)

**User Journey:**

1. Customer opens OHMKenya web/mobile app
2. Enters meter number and amount
3. System shows calculated units
4. Customer clicks "Pay"
5. STK Push sent to customer's phone
6. Customer authorizes with PIN
7. Payment confirmed
8. Token generated and sent
9. Customer receives SMS with token

**USSD Model (Future Enhancement)**

**User Journey:**

1. Customer dials USSD code (e.g., *483*66#)
2. Menu appears: "1. Buy Token 2. Check Balance 3. History"
3. Customer selects "1. Buy Token"
4. Enters meter number
5. Enters amount
6. Confirms purchase
7. STK Push sent for payment
8. Token delivered via SMS

**Modeled After:** KPLC prepaid system

- Similar USSD flow
- Similar paybill payment flow
- Similar token delivery mechanism

---

## Database Schema

### Core Tables

**tariffs**

```
Fields:
- id: Primary key
- name: Text (e.g., 'Domestic Step 1', 'Commercial')
- rate_per_kwh: Decimal (NUMERIC type)
- currency: 'KES'
- valid_from: Timestamp
- valid_to: Timestamp (nullable, for historical rates)
- created_at: Timestamp
```

**meters** (Sub-meters owned by Landlord via Mother Meter)

```
Fields:
- id: Primary key
- meter_number: Unique identifier
- meter_type: 'electricity', 'water', 'gas'
- brand: 'Hexing', 'Stron', 'Conlog'
- mother_meter_id: Foreign key to mother_meters (Ownership flows: Landlord -> Mother Meter -> Sub-meter)
- tariff_id: Foreign key to tariffs table
- supply_group_code: Text (SGC - Critical for STS tokens)
- key_revision_number: Integer (KRN - e.g., 1 or 2)
- tariff_index: Integer (TI - e.g., 01)
- status: 'active', 'inactive', 'suspended'
- created_at: Timestamp
- updated_at: Timestamp
```

**Critical Concept: Tariff Management & Data Integrity**

- **Rate Management:** Rates are managed in the `tariffs` table to allow centralized updates. Meters are linked to a specific tariff.
- **Money Handling:** All monetary values use `DECIMAL`/`NUMERIC` types in Postgres. Application logic MUST use libraries like `dinero.js` or `currency.js` to avoid floating point errors.
- **Historical Data:** Transactions preserve the specific rate used at the time of purchase (snapshot), not just a link to the current tariff.
- **STS Compliance:** `supply_group_code` (SGC) and `key_revision_number` (KRN) are required to generate valid tokens. These must be captured during meter registration.

## Security Architecture

### Credential Storage Strategy

**Context:** There are a limited number of Manufacturer API keys (one per brand: Hexing, Stron, Conlog), not unique keys per meter.

**Solution: Environment Variables / Secret Manager**

1. **Storage:** API Keys are stored as Environment Variables, injected at runtime.
   - `HEXING_API_KEY`
   - `STRON_API_KEY`
   - `CONLOG_API_KEY`
2. **Management:**
   - **Development:** `.env` file (git-ignored).
   - **Production:** Injected via Docker/Kubernetes secrets or a Secret Manager (Infisical, AWS Secrets Manager, HashiCorp Vault).
3. **Usage:** The application logic selects the correct key based on the `meters.brand` field.

**Why this approach?**
Since the keys are static and few in number, they do not belong in the database. Storing them as environment variables is the standard 12-Factor App pattern for configuration and secrets.

**mother_meters** (for landlord's main KPLC meter)

```
Fields:
- id: Primary key
- mother_meter_number: KPLC meter number
- type: 'prepaid', 'postpaid'
- landlord_id: Foreign key to customers
- tariff_id: Foreign key to tariffs table
- property_id: Foreign key to properties table
- total_capacity: Decimal (kW)
- low_balance_threshold: Decimal (Default: 1000 KES - Triggers alert)
- billing_period_start: Integer (Day of month, e.g., 1 - For Postpaid)
- created_at: Timestamp
```

**Note:** `current_balance` is NOT stored. It is calculated on-the-fly:
`Balance = SUM(mother_meter_events.amount) - SUM(transactions.net_amount WHERE meter.mother_meter_id = this)`

**mother_meter_events** (Track KPLC Refills and Bill Payments)

```
Fields:
- id: Primary key
- mother_meter_id: Foreign key to mother_meters
- event_type: 'initial_deposit', 'refill', 'bill_payment'
- amount: Decimal (Amount paid to KPLC)
- kplc_token: Text (For prepaid refills)
- kplc_receipt_number: Text (Reference)
- performed_by: Foreign key to users (Admin who did the action)
- created_at: Timestamp
```

**properties** (Physical Location Grouping)

```
Fields:
- id: Primary key
- landlord_id: Foreign key to customers
- name: Text (e.g., 'Sunrise Apartments')
- location: Text
- number_of_units: Integer
- created_at: Timestamp
```

**Critical Concept: Mother Meter Management**

**1. Prepaid Mother Meters:**

- **Initial Setup:** Landlord pays KES 1,500 deposit to KPLC (Paybill 888880) to initialize tokens.
- **Balance Tracking:** System tracks the _aggregate_ usage of all sub-meters.
- **Refill Alert:** When the calculated balance (Sum of 90% of sub-meter sales) drops below the threshold (e.g., KES 1,000), the system alerts the Admin to "refill" the KPLC token.
- **Logic:** `Mother Meter Balance = Initial Deposit + Refills - (Sum of Sub-meter Net Sales)`.

**2. Postpaid Mother Meters:**

- **Setup:** No deposit required.
- **Usage Tracking:** System tracks total kWh usage via sub-meters during the billing period.
- **Payment:** At the end of the billing period, OHMKenya pays KPLC the exact amount accumulated from the 90% net sales.
- **Reconciliation:** Compare `Sum of Sub-meter Net Sales` vs `KPLC Bill Amount`.

**transactions**

```
Fields:
- id: Primary key
- transaction_id: Unique (OHM-xxx)
- meter_id: Foreign key to meters.id (Proper FK for data integrity)
- phone_number: Customer phone
- mpesa_receipt_number: From M-Pesa (Unique Constraint)
- amount_paid: Decimal (gross amount)
- commission_amount: Decimal (10% of amount)
- net_amount: Decimal (90% to landlord/utility)
- rate_used: Decimal (KPLC rate at time of purchase)
- units_purchased: Decimal (calculated: net_amount / rate_used)
- status: 'pending', 'completed', 'failed'
- payment_method: 'paybill', 'stk_push', 'ussd'
- created_at: Timestamp
- completed_at: Timestamp
```

**Business Rule:** Minimum transaction amount is **KES 30**. Payments below this threshold are rejected.

**mpesa_transactions** (Raw log of all M-Pesa callbacks)

```
Fields:
- id: Primary key
- transaction_type: Text (e.g., 'Pay Bill', 'CustomerPayBillOnline')
- trans_id: Text (Unique - M-Pesa Receipt)
- trans_time: Text (Raw timestamp from M-Pesa)
- trans_amount: Decimal
- business_short_code: Text
- bill_ref_number: Text (Account Number entered by user)
- invoice_number: Text
- org_account_balance: Decimal
- third_party_trans_id: Text
- msisdn: Text (Phone number)
- first_name: Text
- middle_name: Text
- last_name: Text
- raw_callback_payload: JSONB (Store full original JSON for debugging)
- created_at: Timestamp
```

**failed_transactions** (Payments that could not be processed)

```
Fields:
- id: Primary key
- mpesa_transaction_id: Foreign key to mpesa_transactions
- failure_reason: 'invalid_meter', 'below_minimum', 'manufacturer_error', 'sms_failed', 'other'
- failure_details: Text (Detailed error message)
- meter_number_attempted: Text (What the user entered)
- amount: Decimal
- phone_number: Text
- status: 'pending_review', 'refunded', 'resolved', 'abandoned'
- resolved_by: Foreign key to users (Nullable)
- resolution_notes: Text
- created_at: Timestamp
- resolved_at: Timestamp
```

**generated_tokens** (Decoupled from transactions for Tamper/Admin tokens)

```
Fields:
- id: Primary key
- meter_id: Foreign key to meters
- transaction_id: Foreign key to transactions (Nullable - e.g., null for Tamper tokens)
- token: Text (20-digit STS token)
- token_type: 'credit', 'clear_tamper', 'set_power_limit', 'key_change', 'clear_credit'
- value: Decimal (kWh for credit tokens, null for others)
- generated_by: 'system', 'admin', 'landlord'
- created_at: Timestamp
```

**sms_logs** (For reliability and debugging)

```
Fields:
- id: Primary key
- transaction_id: Foreign key to transactions (Nullable)
- phone_number: Text
- message_body: Text
- provider: 'africastalking', 'hostpinnacle'
- status: 'queued', 'sent', 'delivered', 'failed'
- provider_message_id: Text (External ID)
- cost: Decimal (Provider cost)
- created_at: Timestamp
- updated_at: Timestamp
```

**customers** (Business Logic - Linked to Users)

```
Fields:
- id: Primary key
- user_id: Foreign key to users table (Managed by Better-Auth)
- phone_number: Unique (Primary identifier for M-Pesa)
- name: Text
- customer_type: 'tenant', 'landlord'
- created_at: Timestamp
```

---

## Access Control (RBAC) - Internal Admin Portal

**Context:** The web frontend is strictly for OHMKenya staff. It is **NOT** a portal for landlords or tenants.

### Roles & Permissions

**1. Admin**

- **Scope:** Full System Access
- **Capabilities:**
  - **User Management:** Create/Delete User accounts.
  - **Tariff Management:** Create and update tariff rates.
  - **System Config:** Manage API keys (Manufacturer/SMS) and system settings.
  - **Financials:** View total revenue, commission reports, and reconciliation data.
  - **Sensitive Actions:** Generate "Key Change" tokens, Clear Tamper codes.

**2. User**

- **Scope:** Operational & Support Access
- **Capabilities:**
  - **Meter Management:** Register new Mother Meters and Sub-Meters.
  - **Transaction Support:** View transaction logs, check SMS delivery status (`sms_logs`).
  - **Token Retrieval:** Resend existing tokens to customers (via SMS).
  - **Customer Lookup:** Search for customers by phone number or meter number.
  - **Read-Only:** View tariffs (cannot edit).

**audit_logs** (Security & Compliance)

```
Fields:
- id: Primary key
- user_id: Foreign key to users
- action: Text (e.g., 'update_tariff', 'generate_tamper_token', 'refill_mother_meter')
- entity_type: Text (e.g., 'tariff', 'meter', 'mother_meter')
- entity_id: Text
- details: JSONB (Previous values, new values)
- ip_address: Text
- created_at: Timestamp
```

**meter_applications** (Landlord Self-Service Onboarding)

```
Fields:
- id: Primary key
- status: 'pending', 'approved', 'rejected'
- first_name: Text
- last_name: Text
- phone_number: Text
- email: Text
- id_number: Text
- kra_pin: Text
- county: Text
- location: Text
- building_type: 'residential', 'commercial', 'industrial'
- utility_type: 'electricity', 'water'
- mother_meter_number: Text
- initial_reading: Decimal
- payment_mode: 'prepaid', 'postpaid'
- sub_meter_numbers: JSONB (Array of meter numbers)
- installation_type: 'new', 'existing'
- supplies_other_houses: Boolean
- bill_payer: 'kplc', 'landlord'
- technician_name: Text
- technician_phone: Text
- terms_accepted: Boolean
- created_at: Timestamp
```

---

## Unit Calculation Logic

### Formula

**Step 1: Apply Commission**

```
Net Amount = Amount Paid × 0.90
Commission = Amount Paid × 0.10
```

**Step 2: Calculate Units**

```
Units = Net Amount ÷ KPLC Rate per kWh
```

**Example Transaction:**

```
Customer pays: KES 1,000
OHMKenya commission (10%): KES 100
Net amount for electricity: KES 900
Meter's KPLC rate: KES 20/kWh
Units purchased: 900 ÷ 20 = 45 kWh

Token generated for: 45 kWh
```

**Different Rate Example:**

```
Customer pays: KES 1,000
OHMKenya commission (10%): KES 100
Net amount: KES 900
Meter's KPLC rate: KES 24/kWh (commercial rate)
Units purchased: 900 ÷ 24 = 37.5 kWh

Token generated for: 37.5 kWh
```

---

## API Endpoints

### M-Pesa Callback (Current Implementation)

**POST /api/mpesa/callback**

- Receives M-Pesa C2B payment notifications
- Extracts: phone number, amount, meter number (from account field), transaction reference
- Validates signature
- Queues processing job
- Returns 200 OK immediately

**Callback Payload Example:**

```json
{
  "TransactionType": "Pay Bill",
  "TransID": "RK1234567",
  "TransTime": "20251220143045",
  "TransAmount": "1000.00",
  "BusinessShortCode": "600100",
  "BillRefNumber": "12345678",
  "MSISDN": "254712345678",
  "FirstName": "John",
  "LastName": "Doe"
}
```

### Background Job Processing

**Process Payment Job:**

1. Validate meter exists: `SELECT * FROM meters WHERE meter_number = ?`
2. Retrieve Tariff Rate: Join `tariffs` table to get `rate_per_kwh`
3. Calculate commission: `amount * 0.10` (Use money library)
4. Calculate net amount: `amount * 0.90` (Use money library)
5. Calculate units: `net_amount / rate_per_kwh`
6. Call manufacturer API: Pass calculated units
7. Receive token from manufacturer
8. Create transaction record with all details (store snapshot of rate)
9. Queue SMS job with token
10. Update transaction status to 'completed'

---

## Meter Onboarding & Registration

### 1. Self-Service Application (Public Form)

**User Journey:**

1. Landlord visits OHMKenya website "Apply Now".
2. Fills out the **Meter Registration Form** (Personal details, Property details, Meter list, Technician info).
3. Accepts Terms & Conditions.
4. Submits form -> Data saved to `meter_applications` table with status 'pending'.

### 2. Admin Approval Process

**User Journey (Admin/User):**

1. Admin logs into the Internal Portal.
2. Views list of "Pending Applications".
3. Reviews application details (verifies KRA PIN, Meter numbers, etc.).
4. Clicks **"Approve & Register"**.

**System Actions on Approval:**

1. **Create Customer:** Creates record in `customers` table (if not exists).
2. **Create Property:** Creates record in `properties` table.
3. **Create Mother Meter:** Creates record in `mother_meters` table.
4. **Create Sub-Meters:** Iterates through `sub_meter_numbers` and creates records in `meters` table.
5. **Notification:** Sends welcome SMS/Email to Landlord with login details or confirmation.
6. **Update Application:** Sets `meter_applications.status` to 'approved'.

### 3. Manual Registration (Internal)

**Web Form Fields (Admin Portal):**

1. Mother Meter Number (KPLC main meter)
2. Tariff Selection (Select from available tariffs)
3. Sub-meter Number (the prepaid meter being registered)
4. Meter Brand (Hexing/Stron/Conlog)
5. Meter Type (electricity/water/gas)
6. Property/Unit details

**Database Operations:**

1. Create/update mother_meter record with tariff_id
2. Create meter record linked to mother meter
3. Link sub-meter to selected tariff
4. Activate meter for transactions

**Rate Management:**

- Admin updates rates in the `tariffs` table
- Historical transactions preserve the rate used at time of purchase
- Rate changes only affect future transactions
- System can notify landlords when KPLC announces rate changes

---

## SMS Delivery

### Message Format

**Token Purchase Confirmation:**

```
OHMKenya: Token for meter 12345678
Amount: KES 1,000
Units: 45.0 kWh
Token: 1234-5678-9012-3456-7890
Valid until [date]
```

**Alternative Format:**

```
Your OHMKenya token:
1234-5678-9012-3456-7890
Meter: 12345678
45.0 kWh purchased
```

### Delivery System

- Primary: Africa's Talking
- Fallback: Hostpinnacle
- Queue-based with retry logic
- Delivery tracking in database

---

## External Integrations

### M-Pesa Daraja API

- C2B (Customer to Business) for paybill
- Callback URL registration
- Transaction validation
- Future: STK Push for in-app payments

### Manufacturer APIs (Hexing, Stron, Conlog)

- Token generation with calculated units
- Meter configuration
- Tamper codes
- Reset functions
- Response time: typically under 1 second

### SMS Providers

- Africa's Talking (primary)
- Hostpinnacle (fallback)
- Delivery time: 2-4 seconds

---

## Performance Characteristics

### Expected Load

- Average: 1-2 requests/second
- Peak: 10-20 requests/second
- M-Pesa callbacks are async (no user waiting)
- Background processing handles heavy lifting

### Latency Profile

- M-Pesa callback response: Under 100ms (must be fast)
- Background job processing: 2-5 seconds total
  - Database queries: 50-100ms
  - Manufacturer API: 500-1000ms
  - SMS delivery: 2-4 seconds
- Customer receives token: 3-8 seconds after payment

---

## Development Priorities

### Phase 1: Paybill Model (Current)

- M-Pesa C2B integration
- Meter registration with KPLC rates
- Unit calculation logic
- Manufacturer API integration
- SMS delivery
- Transaction tracking
- Offline payment support

### Phase 2: Enhanced Payment Options

- STK Push integration
- Web portal for token purchase
- Mobile app
- Transaction history

### Phase 3: USSD Integration

- USSD menu system
- Session management
- KPLC-style user experience

### Phase 4: Landlord Features

- Dashboard for multiple meters
- Revenue reporting
- Bulk operations
- Tenant management

---

## Critical Implementation Notes

**KPLC Rate Management:**

- Rates must be captured during meter registration
- Rates can differ by meter type (domestic/commercial/industrial)
- System must support rate updates
- Historical transactions preserve original rate used

**Offline-First Design:**

- Paybill works without internet
- No app required for customers
- Asynchronous processing
- Reliable token delivery

**Commission Calculation:**

- Always calculate before unit conversion
- Commission is 10% of gross amount
- Units calculated from net amount (90%)
- All amounts stored in database for transparency

**Error Handling:**

- Invalid meter number: Refund or hold for manual intervention
- Manufacturer API failure: Retry with exponential backoff
- SMS delivery failure: Multiple provider fallback
- All failures tracked in database

This specification provides a complete technical overview of OHMKenya's prepaid metering platform with the current paybill implementation model and clear roadmap for future enhancements.
