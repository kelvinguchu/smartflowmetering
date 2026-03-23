# Audit Logs E2E

Source of truth for this document:
- [audit-logs.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/audit-logs.e2e.test.ts)
- [audit-logs.ts](/D:/smartflowmetering/apps/api/src/routes/audit-logs.ts)
- [audit-log-read.service.ts](/D:/smartflowmetering/apps/api/src/services/audit-log-read.service.ts)

## Purpose

This E2E work verifies the read-only admin audit-log API that will back operational review surfaces in the admin dashboard later.

The API is intentionally:
- admin-only
- read-only
- filterable by exact action and entity identifiers
- enriched with actor name/email when the actor exists in the auth user table

## API Surface

Routes:
- `GET /api/audit-logs`
- `GET /api/audit-logs/:id`

Supported filters:
- `action`
- `actorUserId`
- `entityType`
- `entityId`
- `from`
- `to`
- `limit`
- `offset`

## Security Behavior

The E2E proves:
- non-admin staff receive `403` on audit-log routes
- user-management actions are written to audit logs and can be filtered back out
- log entries return actor enrichment without exposing auth session tokens
- detail lookup returns a stable DTO instead of a raw database row

## Verification Used

```bash
bunx tsc --noEmit
npx eslint apps/api/src/routes/audit-logs.ts apps/api/src/services/audit-log-read.service.ts apps/api/src/validators/audit-logs.ts apps/api/tests/e2e/audit-logs.e2e.test.ts
docker run --rm --network smartflowmetering_backend -v D:\smartflowmetering:/workspace -w /workspace oven/bun:1.3.4 bun test apps/api/tests/e2e/audit-logs.e2e.test.ts
```
