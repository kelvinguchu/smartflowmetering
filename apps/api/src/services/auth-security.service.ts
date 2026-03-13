import { and, count, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { twoFactor, user } from "../db/schema";
import type { AuthUser } from "../lib/auth-middleware";
import { normalizePreferredTwoFactorMethod } from "../lib/staff-contact";
import type { PreferredTwoFactorMethod } from "../lib/staff-contact";
import type { UpdatePreferredTwoFactorMethodInput } from "../validators/auth-security";
import { extractClientIp, writeAuditLog } from "./audit-log.service";

interface SecurityProfile {
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  preferredTwoFactorMethod: PreferredTwoFactorMethod;
  shouldPromptForTotpEnrollment: boolean;
  totpEnabled: boolean;
  totpEnrollmentPromptPending: boolean;
  twoFactorEnabled: boolean;
}

interface SecurityActorContext {
  headers: Headers;
  user: AuthUser;
}

export async function getAuthSecurityProfile(userId: string): Promise<SecurityProfile> {
  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: {
      phoneNumber: true,
      phoneNumberVerified: true,
      preferredTwoFactorMethod: true,
      totpEnrollmentPromptPending: true,
      twoFactorEnabled: true,
    },
  });

  if (!currentUser) {
    throw new HTTPException(404, { message: "User not found" });
  }

  const [totpCount] = await db
    .select({ value: count() })
    .from(twoFactor)
    .where(eq(twoFactor.userId, userId));

  const totpEnabled = totpCount.value > 0;
  const twoFactorEnabled = currentUser.twoFactorEnabled === true;

  return {
    phoneNumber: currentUser.phoneNumber,
    phoneNumberVerified: currentUser.phoneNumberVerified,
    preferredTwoFactorMethod: normalizePreferredTwoFactorMethod(
      currentUser.preferredTwoFactorMethod,
    ),
    shouldPromptForTotpEnrollment:
      twoFactorEnabled &&
      !totpEnabled &&
      currentUser.totpEnrollmentPromptPending,
    totpEnabled,
    totpEnrollmentPromptPending: currentUser.totpEnrollmentPromptPending,
    twoFactorEnabled,
  };
}

export async function acknowledgeTotpEnrollmentPrompt(
  actor: SecurityActorContext,
): Promise<SecurityProfile> {
  await db
    .update(user)
    .set({ totpEnrollmentPromptPending: false })
    .where(eq(user.id, actor.user.id));

  await writeAuditLog({
    userId: actor.user.id,
    action: "auth_security.acknowledge_totp_prompt",
    entityType: "user",
    entityId: actor.user.id,
    details: null,
    ipAddress: extractClientIp(actor.headers),
  });

  return getAuthSecurityProfile(actor.user.id);
}

export async function updatePreferredTwoFactorMethod(
  actor: SecurityActorContext,
  input: UpdatePreferredTwoFactorMethodInput,
): Promise<SecurityProfile> {
  const profile = await getAuthSecurityProfile(actor.user.id);

  if (input.method === "totp" && !profile.totpEnabled) {
    throw new HTTPException(422, {
      message: "TOTP must be enrolled before it can be selected",
    });
  }

  await db
    .update(user)
    .set({
      preferredTwoFactorMethod: input.method,
      totpEnrollmentPromptPending:
        input.method === "totp" ? false : profile.totpEnrollmentPromptPending,
    })
    .where(and(eq(user.id, actor.user.id), eq(user.banned, false)));

  await writeAuditLog({
    userId: actor.user.id,
    action: "auth_security.set_preferred_two_factor_method",
    entityType: "user",
    entityId: actor.user.id,
    details: { method: input.method },
    ipAddress: extractClientIp(actor.headers),
  });

  return getAuthSecurityProfile(actor.user.id);
}
