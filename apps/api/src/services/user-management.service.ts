import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { session } from "../db/schema";
import { auth } from "../lib/auth";
import type { AuthUser } from "../lib/auth-middleware";
import { toBetterAuthHttpException } from "../lib/better-auth-http";
import type {
  ManagedSessionDto,
  ManagedUserDetailDto,
  ManagedUserSummaryDto,
} from "../lib/user-management-dto";
import {
  toManagedSessionDtos,
  toManagedUserDetailDto,
  toManagedUserSummaryDtos,
} from "../lib/user-management-dto";
import { buildBetterAuthListUsersQuery } from "../lib/user-management-query";
import type {
  BanManagedUserInput,
  CreateManagedUserInput,
  ListManagedUsersQuery,
  SetManagedUserPasswordInput,
  SetManagedUserRoleInput,
  UpdateManagedUserInput,
} from "../validators/users";
import {
  extractClientIp,
  writeAuditLog,
} from "./audit-log.service";
import {
  buildManagedUserCreatePayload,
  buildManagedUserUpdatePayload,
} from "./managed-user-policy";

interface AdminActorContext {
  actorUser: AuthUser;
  headers: Headers;
}

interface ManagedUserListResult {
  total: number;
  users: ManagedUserSummaryDto[];
}

export async function listManagedUsers(
  headers: Headers,
  query: ListManagedUsersQuery,
): Promise<ManagedUserListResult> {
  const result = await runBetterAuth(() =>
    auth.api.listUsers({
      headers,
      query: buildBetterAuthListUsersQuery(query),
    }),
  );

  return {
    total: result.total,
    users: await toManagedUserSummaryDtos(result.users),
  };
}

export async function getManagedUser(
  headers: Headers,
  userId: string,
): Promise<ManagedUserDetailDto> {
  const result = await runBetterAuth(() =>
    auth.api.getUser({
      headers,
      query: { id: userId },
    }),
  );

  return toManagedUserDetailDto(result);
}

export async function createManagedUser(
  actor: AdminActorContext,
  input: CreateManagedUserInput,
): Promise<{ user: ManagedUserDetailDto }> {
  const payload = buildManagedUserCreatePayload(input);
  const result = await runBetterAuth(() =>
    auth.api.createUser({
      headers: actor.headers,
      body: payload,
    }),
  );

  await auditManagedUserChange(actor, "create", result.user.id, {
    email: result.user.email,
    role: result.user.role ?? "user",
  });

  return { user: await toManagedUserDetailDto(result.user) };
}

export async function updateManagedUser(
  actor: AdminActorContext,
  userId: string,
  input: UpdateManagedUserInput,
): Promise<ManagedUserDetailDto> {
  const payload = buildManagedUserUpdatePayload(input);
  const result = await runBetterAuth(() =>
    auth.api.adminUpdateUser({
      headers: actor.headers,
      body: {
        userId,
        data: payload,
      },
    }),
  );

  await auditManagedUserChange(actor, "update", userId, {
    fields: Object.keys(payload),
  });

  return toManagedUserDetailDto(result);
}

export async function setManagedUserRole(
  actor: AdminActorContext,
  userId: string,
  input: SetManagedUserRoleInput,
): Promise<{ user: ManagedUserDetailDto }> {
  const result = await runBetterAuth(() =>
    auth.api.setRole({
      headers: actor.headers,
      body: {
        userId,
        role: input.role,
      },
    }),
  );

  await auditManagedUserChange(actor, "set-role", userId, {
    role: input.role,
  });

  return { user: await toManagedUserDetailDto(result.user) };
}

export async function banManagedUser(
  actor: AdminActorContext,
  userId: string,
  input: BanManagedUserInput,
): Promise<{ sessionsRevoked: boolean; user: ManagedUserDetailDto }> {
  const result = await runBetterAuth(() =>
    auth.api.banUser({
      headers: actor.headers,
      body: {
        userId,
        banExpiresIn: input.banExpiresIn,
        banReason: input.banReason,
      },
    }),
  );

  const sessionsRevoked = input.revokeSessions
    ? await revokeAllUserSessions(actor, userId, "ban")
    : false;

  await auditManagedUserChange(actor, "ban", userId, {
    banExpiresIn: input.banExpiresIn ?? null,
    banReason: input.banReason ?? null,
    sessionsRevoked,
  });

  return {
    sessionsRevoked,
    user: await toManagedUserDetailDto(result.user),
  };
}

export async function unbanManagedUser(
  actor: AdminActorContext,
  userId: string,
): Promise<{ user: ManagedUserDetailDto }> {
  const result = await runBetterAuth(() =>
    auth.api.unbanUser({
      headers: actor.headers,
      body: { userId },
    }),
  );

  await auditManagedUserChange(actor, "unban", userId, null);

  return { user: await toManagedUserDetailDto(result.user) };
}

export async function setManagedUserPassword(
  actor: AdminActorContext,
  userId: string,
  input: SetManagedUserPasswordInput,
): Promise<{ sessionsRevoked: boolean; status: boolean }> {
  const result = await runBetterAuth(() =>
    auth.api.setUserPassword({
      headers: actor.headers,
      body: {
        newPassword: input.newPassword,
        userId,
      },
    }),
  );

  const sessionsRevoked = input.revokeSessions
    ? await revokeAllUserSessions(actor, userId, "password-reset")
    : false;

  await auditManagedUserChange(actor, "set-password", userId, {
    sessionsRevoked,
  });

  return {
    sessionsRevoked,
    status: result.status,
  };
}

export async function listManagedUserSessions(
  headers: Headers,
  userId: string,
): Promise<ManagedSessionDto[]> {
  const result = await runBetterAuth(() =>
    auth.api.listUserSessions({
      headers,
      body: { userId },
    }),
  );

  return toManagedSessionDtos(result.sessions);
}

export async function revokeManagedUserSession(
  actor: AdminActorContext,
  userId: string,
  sessionId: string,
): Promise<{ success: boolean }> {
  const sessionToken = await getManagedSessionToken(userId, sessionId);
  const result = await runBetterAuth(() =>
    auth.api.revokeUserSession({
      headers: actor.headers,
      body: { sessionToken },
    }),
  );

  await auditManagedUserChange(actor, "revoke-session", userId, {
    sessionId,
  });

  return result;
}

export async function revokeManagedUserSessions(
  actor: AdminActorContext,
  userId: string,
): Promise<{ success: boolean }> {
  const success = await revokeAllUserSessions(actor, userId, "manual-revoke");
  await auditManagedUserChange(actor, "revoke-all-sessions", userId, null);
  return { success };
}

async function revokeAllUserSessions(
  actor: AdminActorContext,
  userId: string,
  reason: string,
): Promise<boolean> {
  const result = await runBetterAuth(() =>
    auth.api.revokeUserSessions({
      headers: actor.headers,
      body: { userId },
    }),
  );

  await auditManagedUserChange(actor, `revoke-sessions:${reason}`, userId, null);
  return result.success;
}

async function getManagedSessionToken(
  userId: string,
  sessionId: string,
): Promise<string> {
  const records = await db
    .select({
      token: session.token,
    })
    .from(session)
    .where(and(eq(session.id, sessionId), eq(session.userId, userId)))
    .limit(1);

  if (records.length === 0) {
    throw new HTTPException(404, {
      message: "User session not found",
    });
  }

  return records[0].token;
}

async function auditManagedUserChange(
  actor: AdminActorContext,
  action: string,
  targetUserId: string,
  details: Record<string, boolean | number | string | string[] | null> | null,
) {
  await writeAuditLog({
    userId: actor.actorUser.id,
    action: `user_management.${action}`,
    entityType: "user",
    entityId: targetUserId,
    details,
    ipAddress: extractClientIp(actor.headers),
  });
}

async function runBetterAuth<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const errorObject =
      typeof error === "object" && error !== null ? error : null;
    throw toBetterAuthHttpException(errorObject);
  }
}
