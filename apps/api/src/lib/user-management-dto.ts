import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { account, session, twoFactor, user } from "../db/schema";
import type { auth } from "./auth";
import {
  normalizePreferredTwoFactorMethod,
} from "./staff-contact";
import type { PreferredTwoFactorMethod } from "./staff-contact";

type BetterAuthManagedUser = Awaited<ReturnType<typeof auth.api.getUser>>;
type BetterAuthManagedSession = Awaited<
  ReturnType<typeof auth.api.listUserSessions>
>["sessions"][number];

export interface ManagedUserSummaryDto {
  activeSessionCount: number;
  banExpires: string | null;
  banReason: string | null;
  banned: boolean;
  createdAt: string;
  email: string;
  emailVerified: boolean;
  hasPasswordCredential: boolean;
  id: string;
  image: string | null;
  name: string;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  preferredTwoFactorMethod: PreferredTwoFactorMethod;
  role: string | null;
  totpEnabled: boolean;
  totpEnrollmentPromptPending: boolean;
  twoFactorEnabled: boolean;
  updatedAt: string;
}

export type ManagedUserDetailDto = ManagedUserSummaryDto;

export interface ManagedSessionDto {
  createdAt: string;
  expiresAt: string;
  id: string;
  impersonatedBy: string | null;
  ipAddress: string | null;
  updatedAt: string;
  userAgent: string | null;
}

export async function toManagedUserSummaryDtos(
  users: BetterAuthManagedUser[],
): Promise<ManagedUserSummaryDto[]> {
  const metadata = await loadManagedUserMetadata(
    users.map((currentUser) => currentUser.id),
  );
  return users.map((currentUser) => toManagedUserDto(currentUser, metadata));
}

export async function toManagedUserDetailDto(
  user: BetterAuthManagedUser,
): Promise<ManagedUserDetailDto> {
  const metadata = await loadManagedUserMetadata([user.id]);
  return toManagedUserDto(user, metadata);
}

export function toManagedSessionDtos(
  sessions: BetterAuthManagedSession[],
): ManagedSessionDto[] {
  return sessions.map((currentSession) => ({
    createdAt: currentSession.createdAt.toISOString(),
    expiresAt: currentSession.expiresAt.toISOString(),
    id: currentSession.id,
    impersonatedBy: currentSession.impersonatedBy ?? null,
    ipAddress: currentSession.ipAddress ?? null,
    updatedAt: currentSession.updatedAt.toISOString(),
    userAgent: currentSession.userAgent ?? null,
  }));
}

async function loadManagedUserMetadata(userIds: string[]) {
  if (userIds.length === 0) {
    return {
      activeSessionCounts: new Map<string, number>(),
      credentialUserIds: new Set<string>(),
      totpEnabledUserIds: new Set<string>(),
      twoFactorEnabledByUserId: new Map<string, boolean>(),
      phoneNumberByUserId: new Map<string, string | null>(),
      phoneNumberVerifiedByUserId: new Map<string, boolean>(),
      preferredTwoFactorMethodByUserId: new Map<string, PreferredTwoFactorMethod>(),
      totpEnrollmentPromptPendingByUserId: new Map<string, boolean>(),
    };
  }

  const [sessionCounts, credentialAccounts, totpRows, userRows] = await Promise.all([
    db
      .select({
        activeSessionCount: sql<number>`count(*)::int`,
        userId: session.userId,
      })
      .from(session)
      .where(and(inArray(session.userId, userIds), gt(session.expiresAt, new Date())))
      .groupBy(session.userId),
    db
      .select({ userId: account.userId })
      .from(account)
      .where(and(inArray(account.userId, userIds), eq(account.providerId, "credential"))),
    db
      .select({ userId: twoFactor.userId })
      .from(twoFactor)
      .where(inArray(twoFactor.userId, userIds)),
    db
      .select({
        id: user.id,
        phoneNumber: user.phoneNumber,
        phoneNumberVerified: user.phoneNumberVerified,
        preferredTwoFactorMethod: user.preferredTwoFactorMethod,
        totpEnrollmentPromptPending: user.totpEnrollmentPromptPending,
        twoFactorEnabled: user.twoFactorEnabled,
      })
      .from(user)
      .where(inArray(user.id, userIds)),
  ]);

  return {
    activeSessionCounts: new Map(
      sessionCounts.map((currentCount) => [
        currentCount.userId,
        currentCount.activeSessionCount,
      ]),
    ),
    credentialUserIds: new Set(
      credentialAccounts.map((currentAccount) => currentAccount.userId),
    ),
    totpEnabledUserIds: new Set(totpRows.map((currentTwoFactor) => currentTwoFactor.userId)),
    twoFactorEnabledByUserId: new Map(
      userRows.map((currentUser) => [
        currentUser.id,
        currentUser.twoFactorEnabled ?? false,
      ]),
    ),
    phoneNumberByUserId: new Map(
      userRows.map((currentUser) => [currentUser.id, currentUser.phoneNumber]),
    ),
    phoneNumberVerifiedByUserId: new Map(
      userRows.map((currentUser) => [currentUser.id, currentUser.phoneNumberVerified]),
    ),
    preferredTwoFactorMethodByUserId: new Map(
      userRows.map((currentUser) => [
        currentUser.id,
        normalizePreferredTwoFactorMethod(currentUser.preferredTwoFactorMethod),
      ]),
    ),
    totpEnrollmentPromptPendingByUserId: new Map(
      userRows.map((currentUser) => [
        currentUser.id,
        currentUser.totpEnrollmentPromptPending,
      ]),
    ),
  };
}

function toManagedUserDto(
  user: BetterAuthManagedUser,
  metadata: {
    activeSessionCounts: Map<string, number>;
    credentialUserIds: Set<string>;
    totpEnabledUserIds: Set<string>;
    twoFactorEnabledByUserId: Map<string, boolean>;
    phoneNumberByUserId: Map<string, string | null>;
    phoneNumberVerifiedByUserId: Map<string, boolean>;
    preferredTwoFactorMethodByUserId: Map<string, PreferredTwoFactorMethod>;
    totpEnrollmentPromptPendingByUserId: Map<string, boolean>;
  },
): ManagedUserDetailDto {
  return {
    activeSessionCount: metadata.activeSessionCounts.get(user.id) ?? 0,
    banExpires: user.banExpires?.toISOString() ?? null,
    banReason: user.banReason ?? null,
    banned: user.banned ?? false,
    createdAt: user.createdAt.toISOString(),
    email: user.email,
    emailVerified: user.emailVerified,
    hasPasswordCredential: metadata.credentialUserIds.has(user.id),
    id: user.id,
    image: user.image ?? null,
    name: user.name,
    phoneNumber: metadata.phoneNumberByUserId.get(user.id) ?? null,
    phoneNumberVerified: metadata.phoneNumberVerifiedByUserId.get(user.id) ?? false,
    preferredTwoFactorMethod:
      metadata.preferredTwoFactorMethodByUserId.get(user.id) ?? "sms",
    role: user.role ?? null,
    totpEnabled: metadata.totpEnabledUserIds.has(user.id),
    totpEnrollmentPromptPending:
      metadata.totpEnrollmentPromptPendingByUserId.get(user.id) ?? true,
    twoFactorEnabled: metadata.twoFactorEnabledByUserId.get(user.id) ?? false,
    updatedAt: user.updatedAt.toISOString(),
  };
}
