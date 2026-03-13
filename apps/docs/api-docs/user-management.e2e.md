# User Management E2E

Source of truth for this document:
- [user-management.e2e.test.ts](/D:/smartflowmetering/apps/api/tests/e2e/user-management.e2e.test.ts)
- [users.ts](/D:/smartflowmetering/apps/api/src/routes/users.ts)
- [user-management.service.ts](/D:/smartflowmetering/apps/api/src/services/user-management.service.ts)
- [auth.ts](/D:/smartflowmetering/apps/api/src/lib/auth.ts)

## Purpose

This E2E work verifies that staff account management is handled through Better Auth's admin plugin, but exposed through the API's own `/api/users` routes so we can:

- keep a stable internal API shape
- enforce our RBAC policy
- audit privileged user-management actions
- avoid exposing Better Auth session tokens to clients
- avoid hard delete as the default lifecycle action

## Better Auth Alignment

The implementation is intentionally built on top of Better Auth admin APIs instead of writing directly to auth tables for management flows.

Used Better Auth admin capabilities:
- `listUsers`
- `getUser`
- `createUser`
- `adminUpdateUser`
- `setRole`
- `banUser`
- `unbanUser`
- `setUserPassword`
- `listUserSessions`
- `revokeUserSession`
- `revokeUserSessions`

Not exposed in this API slice:
- `removeUser`
  because it hard deletes records
- `impersonateUser`
  because it is a higher-risk operational feature and not needed yet

## API Surface

Routes:
- [users.ts](/D:/smartflowmetering/apps/api/src/routes/users.ts)

Admin-only endpoints:
- `GET /api/users`
- `GET /api/users/:userId`
- `POST /api/users`
- `PATCH /api/users/:userId`
- `POST /api/users/:userId/role`
- `POST /api/users/:userId/ban`
- `POST /api/users/:userId/unban`
- `POST /api/users/:userId/password`
- `GET /api/users/:userId/sessions`
- `POST /api/users/:userId/sessions/:sessionId/revoke`
- `POST /api/users/:userId/sessions/revoke-all`

DTO behavior:
- list and detail responses return stable admin-facing DTOs
- DTOs include `activeSessionCount`
- DTOs include `hasPasswordCredential`
- DTOs normalize dates to ISO strings

Dashboard-friendly filters:
- `q`
- `role`
- `banned`
- `emailVerified`
- `twoFactorEnabled`
- plus the underlying Better Auth search/filter/sort query fields

## Security Behavior

The E2E proves:
- non-admin staff receive `403` on `/api/users`
- created users are managed through Better Auth, not raw table writes
- user list/detail responses are DTO-shaped for dashboard use
- listed sessions do not include raw session tokens
- single-session revocation is done by server-side lookup from `session.id` to token
- banning a user can revoke all sessions
- password rotation can revoke all sessions
- unban restores access without deleting the user record

## Record Retention Decision

This slice does not add a delete endpoint.

Current lifecycle recommendation:
- use `ban` to deactivate accounts
- use `unban` to restore access
- keep user, session, and audit records intact

If hard delete is ever introduced later, it should be a separate explicit workflow with stronger safeguards and policy review.

## Verification Used

```bash
bunx tsc --noEmit
npx eslint apps/api/src/lib/better-auth-http.ts apps/api/src/lib/rbac.ts apps/api/src/routes/users.ts apps/api/src/services/user-management.service.ts apps/api/src/validators/users.ts apps/api/tests/e2e/user-management.e2e.test.ts
docker run --rm --network smartflowmetering_backend -v D:\smartflowmetering:/workspace -w /workspace oven/bun:1.3.4 bun test apps/api/tests/e2e/user-management.e2e.test.ts
```
