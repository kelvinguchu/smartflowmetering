# POS Asset Tracking Integration Plan

## Goal

Add a POS-style asset tracking layer to the current API so the business can trace a physical meter from procurement through customer-side ownership context.

The specific business question this should answer is:

- When was this meter bought?
- What batch/vendor did it come from?
- What brand and type is it?
- Which mother meter is it associated with?
- Which landlord/property currently owns that metering setup?

This plan is intentionally designed for the current Smart Flow API and data model.

It is **not** a proposal to merge the old POS application into this repo and it is **not** a proposal to replace the live operational meter model.

## What Exists Today

The current API already models the live metering world well:

- `customers`
- `properties`
- `mother_meters`
- `meters`
- `meter_applications`
- `transactions`
- `generated_tokens`
- `mother_meter_events`

Relevant current schema files:

- [customers.ts](/D:/smartflowmetering/apps/api/src/db/schema/customers.ts)
- [properties.ts](/D:/smartflowmetering/apps/api/src/db/schema/properties.ts)
- [mother-meters.ts](/D:/smartflowmetering/apps/api/src/db/schema/mother-meters.ts)
- [meters.ts](/D:/smartflowmetering/apps/api/src/db/schema/meters.ts)
- [meter-applications.ts](/D:/smartflowmetering/apps/api/src/db/schema/meter-applications.ts)
- [index.ts](/D:/smartflowmetering/apps/api/src/db/schema/index.ts)

Today the system already knows:

- landlord identity
- property ownership
- mother meter ownership by landlord
- sub-meter brand
- sub-meter tariff linkage
- operational meter number and mother-meter association

What it does **not** know today:

- procurement date of the physical device
- procurement batch/vendor/source
- asset cost and purchase metadata
- whether the physical unit passed through stock allocation before being tied to a live meter
- a durable asset-level history independent of the operational meter record

## Core Design Principle

Do not overload the existing live operational tables with procurement and POS concerns.

Instead:

- keep `mother_meters` and `meters` as the live operational model
- add an `inventory` / `asset-tracking` domain for physical meter units
- link physical assets to the existing live records
- derive current customer-side ownership from the current live relationships

This keeps the system clean:

- physical asset history lives in one place
- live token/payment/operations remain unchanged
- landlord ownership still flows through the existing mother-meter model

## Domain Boundary

The new domain should answer:

- physical asset provenance
- stock and movement trail
- linkage from a physical device to a live operational record
- landlord/property ownership context through the associated mother meter

The new domain should **not** own:

- customer auth
- mobile access
- token sales
- tariff logic
- payment workflows
- tenant ownership logic

## Ownership Model

This must follow the repository ownership rule already documented in `AGENTS.md`.

Important constraints:

- the landlord is the customer-side owner
- the mother meter is the ownership anchor
- tenants do not own sub-meters in the core model

So for asset tracking:

- a mother-meter asset can link directly to `mother_meters`
- a sub-meter asset links to `meters`
- current landlord ownership is then derived from the associated `mother_meters.landlord_id`

That means the system can answer:

- "Which landlord has this sub-meter asset?" by traversing `meter_asset_links -> meters -> mother_meters -> customers`
- "Which mother meter is this asset under?" by traversing the same path

## Recommended Data Model

### 1. `meter_asset_batches`

Purpose:

- record procurement or inbound batch-level metadata

Recommended columns:

- `id`
- `batch_ref`
- `supplier_name`
- `purchase_order_ref`
- `invoice_ref`
- `received_at`
- `purchased_at`
- `currency`
- `notes`
- `created_by_user_id`
- `created_at`

Recommended rules:

- `batch_ref` unique
- `supplier_name` required
- `received_at` required for stock-on-hand tracking

### 2. `meter_assets`

Purpose:

- one row per physical meter unit

Recommended columns:

- `id`
- `serial_number`
- `asset_kind`
- `meter_type`
- `brand`
- `batch_id`
- `procurement_status`
- `purchase_cost`
- `current_condition`
- `notes`
- `created_at`
- `updated_at`

Recommended enums:

- `asset_kind`: `mother_meter`, `sub_meter`
- `procurement_status`: `in_stock`, `reserved`, `issued`, `linked`, `faulty`, `returned`, `retired`
- `current_condition`: `new`, `good`, `faulty`, `repaired`, `scrapped`

Important notes:

- `serial_number` should be unique and normalized
- keep `brand` aligned with current `meterBrandEnum` where possible
- `meter_type` should align with current `meterTypeEnum`

### 3. `meter_asset_movements`

Purpose:

- append-only movement/history ledger

Recommended columns:

- `id`
- `asset_id`
- `event_type`
- `from_state`
- `to_state`
- `reference_type`
- `reference_id`
- `performed_by_user_id`
- `notes`
- `metadata`
- `occurred_at`
- `created_at`

Recommended enums:

- `event_type`: `purchased`, `received`, `reserved_for_application`, `issued_to_landlord_setup`, `linked_to_live_meter`, `returned`, `marked_faulty`, `repaired`, `retired`

Recommended reference types:

- `batch`
- `application`
- `mother_meter`
- `meter`
- `manual_adjustment`

Why append-only matters:

- asset history stays auditable
- replacements and corrections do not destroy previous state
- support/admin can investigate lineage later

### 4. `meter_asset_links`

Purpose:

- connect a physical asset to the current live operational record

Recommended columns:

- `id`
- `asset_id`
- `linked_entity_type`
- `mother_meter_id`
- `meter_id`
- `is_active`
- `linked_at`
- `unlinked_at`
- `linked_by_user_id`
- `notes`

Recommended rules:

- `linked_entity_type` is either `mother_meter` or `sub_meter`
- exactly one of `mother_meter_id` or `meter_id` must be set
- an asset should have at most one active link
- a live meter should have at most one active asset link

This is the key table that bridges procurement and ownership context.

## Why Link Tables Are Better Than Extra Columns on `meters`

It may be tempting to add `bought_at`, `batch_id`, and `vendor` directly to:

- `meters`
- `mother_meters`

That is too limiting.

Problems with that approach:

- a physical meter may be replaced later
- one live operational meter slot can involve multiple physical devices over time
- historical asset provenance is lost when a replacement happens
- mother meters and sub-meters need a consistent asset model

Using asset tables plus link tables gives:

- proper physical lineage
- replacement support
- history without mutating operational truth

## Relationship to Current Schema

### Mother meter assets

Flow:

- `meter_assets.asset_kind = mother_meter`
- active link in `meter_asset_links` points to `mother_meters.id`
- ownership comes from `mother_meters.landlord_id`

### Sub-meter assets

Flow:

- `meter_assets.asset_kind = sub_meter`
- active link in `meter_asset_links` points to `meters.id`
- ownership comes from `meters.mother_meter_id -> mother_meters.landlord_id`

### Landlord ownership view

To answer "which landlord owns this meter asset now?":

- if linked to `mother_meters`, join directly to `customers`
- if linked to `meters`, join through `mother_meters`

### Property ownership view

To answer "which property is this asset currently under?":

- `mother_meters.property_id`

## Minimal Viable Scope

The first version should not try to recreate the full old POS application.

It should solve the business traceability problem first.

### MVP capabilities

1. Create procurement batches
2. Register individual physical assets
3. Link assets to existing mother meters or sub-meters
4. View asset lineage for a live meter
5. View all assets currently under a landlord or property
6. View movement history for an asset

### Explicitly defer for later

1. store/branch inventory
2. agent inventory workflows
3. sale/receipt PDFs
4. prospect tracking
5. stock transfer approvals
6. customer-facing POS features

That keeps the first rollout realistic and low risk.

## Route Structure Recommendation

The current API already uses feature folders under `src/routes` and `src/services`.

Recommended new folders:

- `src/routes/inventory`
- `src/services/inventory`

Recommended route files:

- `src/routes/inventory/batches.ts`
- `src/routes/inventory/assets.ts`
- `src/routes/inventory/links.ts`
- `src/routes/inventory/history.ts`
- `src/routes/inventory/reports.ts`

Recommended service files:

- `src/services/inventory/inventory-batches.service.ts`
- `src/services/inventory/inventory-assets.service.ts`
- `src/services/inventory/inventory-links.service.ts`
- `src/services/inventory/inventory-history.service.ts`
- `src/services/inventory/inventory-ownership.service.ts`
- `src/services/inventory/inventory-reporting.service.ts`

## Recommended API Endpoints

### Batches

`POST /api/inventory/batches`

- create a procurement batch

`GET /api/inventory/batches`

- list batches with counts and filters

`GET /api/inventory/batches/:id`

- batch details and included assets

### Assets

`POST /api/inventory/assets`

- create single asset

`POST /api/inventory/assets/bulk`

- bulk register assets by serial range or uploaded list

`GET /api/inventory/assets`

- filter by:
  - `serialNumber`
  - `brand`
  - `meterType`
  - `assetKind`
  - `batchId`
  - `procurementStatus`
  - `landlordId`
  - `propertyId`
  - `motherMeterId`
  - `meterId`

`GET /api/inventory/assets/:id`

- asset detail including current active link and ownership context

### Links

`POST /api/inventory/links`

- link asset to `mother_meter` or `sub_meter`

`POST /api/inventory/links/:id/deactivate`

- close an active link when a replacement or correction happens

### History

`GET /api/inventory/assets/:id/history`

- movement and linkage history for one asset

`POST /api/inventory/assets/:id/events`

- append a manual asset event

### Ownership reports

`GET /api/inventory/landlords/:landlordId/assets`

- all active assets under a landlord

`GET /api/inventory/properties/:propertyId/assets`

- all active assets under a property

`GET /api/inventory/mother-meters/:motherMeterId/assets`

- mother-meter asset plus all linked sub-meter assets under it

## Recommended Response Shapes

### Asset detail response

```json
{
  "data": {
    "id": "asset_uuid",
    "serialNumber": "SM12345678",
    "assetKind": "sub_meter",
    "meterType": "electricity",
    "brand": "hexing",
    "procurement": {
      "batchId": "batch_uuid",
      "batchRef": "PO-2026-0031",
      "supplierName": "Supplier Ltd",
      "purchasedAt": "2026-03-20T10:00:00.000Z",
      "receivedAt": "2026-03-22T11:00:00.000Z",
      "purchaseCost": "4500.00"
    },
    "status": "linked",
    "activeLink": {
      "linkedEntityType": "sub_meter",
      "meterId": "meter_uuid",
      "motherMeterId": "mother_meter_uuid",
      "meterNumber": "12345678901",
      "motherMeterNumber": "99887766554",
      "landlordId": "customer_uuid",
      "landlordName": "Jane Doe",
      "propertyId": "property_uuid",
      "propertyName": "Sunrise Apartments",
      "linkedAt": "2026-03-25T08:00:00.000Z"
    }
  }
}
```

### Landlord asset listing response

```json
{
  "data": {
    "landlordId": "customer_uuid",
    "landlordName": "Jane Doe",
    "properties": [
      {
        "propertyId": "property_uuid",
        "propertyName": "Sunrise Apartments",
        "motherMeters": [
          {
            "motherMeterId": "mother_meter_uuid",
            "motherMeterNumber": "99887766554",
            "motherMeterAsset": {
              "assetId": "asset_uuid",
              "serialNumber": "MM-ABC-001",
              "brand": "conlog",
              "purchasedAt": "2026-01-10T00:00:00.000Z"
            },
            "subMeterAssets": [
              {
                "assetId": "asset_uuid_2",
                "serialNumber": "SM12345678",
                "brand": "hexing",
                "meterId": "meter_uuid",
                "meterNumber": "12345678901",
                "purchasedAt": "2026-01-10T00:00:00.000Z"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

## Service Logic Recommendation

### `inventory-ownership.service.ts`

Responsibilities:

- resolve active landlord/property ownership context for an asset
- resolve all assets under a landlord
- resolve all assets under a mother meter

This service should centralize the join logic so route handlers stay thin.

### `inventory-links.service.ts`

Responsibilities:

- validate entity type and target existence
- enforce one active link per asset
- enforce one active asset link per live meter record
- create link history events

### `inventory-history.service.ts`

Responsibilities:

- return append-only history
- merge movement and link events into a unified timeline

### `inventory-assets.service.ts`

Responsibilities:

- asset creation
- bulk asset registration
- serial normalization
- dedupe protection
- asset status transitions

## Validation Rules

All new inventory endpoints should validate at the route boundary.

Examples:

- serial numbers normalized and unique
- `assetKind` must match link target type
- sub-meter asset cannot be linked directly to `mother_meters`
- mother-meter asset cannot be linked directly to `meters`
- one active link per asset
- one active asset per live meter record
- batch existence required if `batchId` supplied

Recommended new validator files:

- `src/validators/inventory-batches.ts`
- `src/validators/inventory-assets.ts`
- `src/validators/inventory-links.ts`

## RBAC Recommendation

This is an internal staff/admin domain.

Suggested permissions:

- `inventory_batches:create`
- `inventory_batches:read`
- `inventory_assets:create`
- `inventory_assets:read`
- `inventory_assets:update`
- `inventory_assets:link`
- `inventory_assets:audit`

Recommended default access:

- admins: full access
- support: read-only where needed, but not mutation by default

Reason:

- procurement and asset lineage are sensitive operational records
- support teams may need read access for troubleshooting
- write access should remain tightly controlled

## How This Fits Into Current Onboarding

The current onboarding flow in [application-onboarding.service.ts](/D:/smartflowmetering/apps/api/src/services/applications/application-onboarding.service.ts) creates:

- customer
- property
- mother meter
- sub-meters

This can be enhanced later with inventory awareness.

### Suggested future enhancement

During approval:

- optionally supply pre-existing `meterAssetId` values for the mother meter and sub-meters
- link those assets to the created live records

Important:

- do not make inventory mandatory for the first rollout
- allow onboarding to continue even where old records have no procurement history

That keeps adoption practical.

## Backfill Strategy

The current system already has live mother meters and sub-meters with no procurement records.

Recommended backfill approach:

### Phase A: Schema only

- add new tables
- do not backfill automatically yet

### Phase B: Create placeholder assets for existing live records

For each existing:

- `mother_meters` row
- `meters` row

Create a `meter_assets` row with:

- `serial_number` from operational meter number if no better serial exists
- `brand` from existing `meters.brand` where available
- `batch_id = null`
- `procurement_status = linked`
- note such as `"Backfilled from live operational meter"`

Then create active links.

### Phase C: Manual enrichment

Allow admins to fill in:

- real supplier
- batch
- bought date
- cost
- notes

This avoids blocking rollout on perfect historical data.

## Migration Sequence

### Phase 1: Foundation

1. add new enums
2. add new schema tables
3. export them from `src/db/schema/index.ts`
4. add relations
5. run migration

### Phase 2: Read path

1. add inventory services
2. add read-only routes
3. support landlord/property/mother-meter filtered queries
4. add audit logging for sensitive reads if desired

### Phase 3: Write path

1. add batch creation
2. add asset creation
3. add link creation
4. add movement logging

### Phase 4: Backfill

1. backfill live records into placeholder assets
2. verify counts
3. expose data in admin UI

### Phase 5: Onboarding integration

1. accept optional asset IDs during application approval
2. automatically create active links after live records are created

## Query Patterns the Business Will Need

The design should make these queries simple:

### Find a physical meter by serial and see who has it

Input:

- serial number

Output:

- batch/vendor/purchase date
- active operational link
- mother meter number
- landlord name
- property name

### Show all meters under a landlord

Input:

- landlord ID

Output:

- mother-meter asset
- all sub-meter assets
- batch and purchase date
- brand and type

### Show all meters under a mother meter

Input:

- mother meter ID

Output:

- mother-meter asset
- linked sub-meter assets
- grouped by live meter number

### Show procurement lineage for a live meter

Input:

- `meterId` or `motherMeterId`

Output:

- linked asset
- procurement batch
- supplier
- movement history

## Reporting Ideas for Later

Once the core tables exist, the same API can support:

- assets by supplier
- assets by brand
- assets by procurement month
- assets under each landlord
- assets with missing batch history
- faulty assets by brand
- replacements by mother meter

These should be built on top of the base inventory domain, not embedded into onboarding services.

## Security and Audit Notes

This domain touches sensitive internal operations.

Rules to keep:

- validate all write inputs
- keep broad inventory reads restricted to staff/admin
- no raw procurement secrets or supplier credentials in logs
- audit asset linking and status changes
- never allow client-facing mobile routes to expose internal procurement fields by default

Recommended audit actions:

- `inventory_batch_created`
- `inventory_asset_created`
- `inventory_asset_linked`
- `inventory_asset_unlinked`
- `inventory_asset_status_changed`
- `inventory_asset_backfilled`

## Testing Plan

### Unit tests

- serial normalization
- link validation
- asset status transitions
- ownership resolution

### E2E tests

Add focused E2E coverage for:

- create batch
- register asset
- link sub-meter asset to live meter
- link mother-meter asset to live mother meter
- list landlord assets
- reject invalid cross-links
- enforce RBAC

Suggested files:

- `tests/e2e/inventory-batches.e2e.test.ts`
- `tests/e2e/inventory-assets.e2e.test.ts`
- `tests/e2e/inventory-links.e2e.test.ts`
- `tests/e2e/inventory-ownership.e2e.test.ts`

## Recommended First Delivery

The best first delivery is not "full POS".

It is:

1. add procurement batch tracking
2. add physical asset records
3. add active links to mother meters and sub-meters
4. add landlord/property ownership views
5. backfill existing live meters

That already solves the business need:

- track from when the meter was bought
- know its brand and procurement lineage
- know which mother meter it belongs to
- know which landlord/property currently owns the setup

## Implementation Recommendation Summary

Use the current API as the foundation.

Do this by introducing a new `inventory` domain with:

- `meter_asset_batches`
- `meter_assets`
- `meter_asset_movements`
- `meter_asset_links`

Keep ownership derived from the existing live model:

- sub-meter asset -> `meters` -> `mother_meters` -> `customers`
- mother-meter asset -> `mother_meters` -> `customers`

Do not push procurement and lineage fields directly into the current live tables except where a tiny cached denormalized field is justified later.

This gives the platform a POS-style traceability layer without corrupting the existing operational meter model.
