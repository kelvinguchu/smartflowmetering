import { eq } from "drizzle-orm";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import { user } from "../../src/db/schema";
import {
  createAuthenticatedSession,
  ensureInfraReady,
  teardownE2E,
  uniqueKenyanPhoneNumber,
  uniqueRef,
} from "./helpers";

const app = createApp();

void describe("E2E: auth security", () => {
  before(async () => {
    await ensureInfraReady();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("returns the current user security profile and lets them acknowledge the TOTP prompt", async () => {
    const session = await createAuthenticatedSession(app, "user");
    const phoneNumber = uniqueKenyanPhoneNumber();
    const userId = await insertSecurityProfileUser(session.email, phoneNumber);

    const profileResponse = await app.request("/api/auth-security/profile", {
      method: "GET",
      headers: session.headers,
    });

    assert.equal(profileResponse.status, 200);
    const profileBody = (await profileResponse.json()) as {
      data: {
        phoneNumber: string | null;
        preferredTwoFactorMethod: string;
        shouldPromptForTotpEnrollment: boolean;
        totpEnrollmentPromptPending: boolean;
        twoFactorEnabled: boolean;
      };
    };

    assert.equal(profileBody.data.phoneNumber, phoneNumber);
    assert.equal(profileBody.data.preferredTwoFactorMethod, "sms");
    assert.equal(profileBody.data.shouldPromptForTotpEnrollment, true);
    assert.equal(profileBody.data.totpEnrollmentPromptPending, true);
    assert.equal(profileBody.data.twoFactorEnabled, true);

    const acknowledgeResponse = await app.request(
      "/api/auth-security/totp-prompt/acknowledge",
      {
        method: "POST",
        headers: session.headers,
      },
    );

    assert.equal(acknowledgeResponse.status, 200);
    const updatedUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { totpEnrollmentPromptPending: true },
    });

    assert.equal(updatedUser?.totpEnrollmentPromptPending, false);
  });

  void it("prevents selecting TOTP as the default method before it is enrolled", async () => {
    const session = await createAuthenticatedSession(app, "user");
    await insertSecurityProfileUser(session.email, uniqueKenyanPhoneNumber());

    const response = await app.request("/api/auth-security/preferred-method", {
      method: "POST",
      headers: session.headers,
      body: JSON.stringify({ method: "totp" }),
    });

    assert.equal(response.status, 422);
  });
});

async function insertSecurityProfileUser(
  email: string,
  phoneNumber: string,
): Promise<string> {
  const [updatedUser] = await db
    .update(user)
    .set({
      email,
      emailVerified: true,
      phoneNumber,
      phoneNumberVerified: true,
      preferredTwoFactorMethod: "sms",
      role: "user",
      totpEnrollmentPromptPending: true,
      twoFactorEnabled: true,
    })
    .where(eq(user.email, email))
    .returning({ id: user.id });

  assert.ok(updatedUser, `Expected seeded auth-security user for ${uniqueRef("security")}`);
  return updatedUser.id;
}
