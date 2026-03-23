import { eq } from "drizzle-orm";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createApp } from "../../src/app";
import { db } from "../../src/db";
import { user } from "../../src/db/schema";
import { signInWithEmailAndTwoFactor } from "./auth-session";
import {
  createAuthenticatedSession,
  ensureInfraReady,
  teardownE2E,
  uniqueKenyanPhoneNumber,
  uniqueRef,
} from "./helpers";

const app = createApp();

void describe("E2E: user management", () => {
  before(async () => {
    await ensureInfraReady();
  });

  after(async () => {
    await teardownE2E();
  });

  void it("keeps user management restricted to admins", async () => {
    const userSession = await createAuthenticatedSession(app, "user");
    const response = await app.request("/api/users", {
      method: "GET",
      headers: userSession.headers,
    });

    assert.equal(response.status, 403);
  });

  void it("lets admins create, read, update, and change user roles", async () => {
    const adminSession = await createAuthenticatedSession(app, "admin");
    const normalizedPhoneNumber = uniqueKenyanPhoneNumber();
    const createPayload = {
      email: `${uniqueRef("staff")}@gmail.com`,
      name: "Support Agent",
      phoneNumber: normalizedPhoneNumber,
      password: "Passw0rd!",
      role: "user",
    };

    const createResponse = await app.request("/api/users", {
      method: "POST",
      headers: adminSession.headers,
      body: JSON.stringify(createPayload),
    });
    assert.equal(createResponse.status, 201);

    const createdBody = (await createResponse.json()) as {
      data: {
        activeSessionCount: number;
        email: string;
        emailVerified: boolean;
        hasPasswordCredential: boolean;
        id: string;
        phoneNumber: string | null;
        phoneNumberVerified: boolean;
        preferredTwoFactorMethod: string;
        role: string | null;
        totpEnrollmentPromptPending: boolean;
        twoFactorEnabled: boolean;
      };
    };
    assert.equal(createdBody.data.activeSessionCount, 0);
    assert.equal(createdBody.data.email, createPayload.email);
    assert.equal(createdBody.data.emailVerified, true);
    assert.equal(createdBody.data.hasPasswordCredential, true);
    assert.equal(createdBody.data.phoneNumber, normalizedPhoneNumber);
    assert.equal(createdBody.data.phoneNumberVerified, true);
    assert.equal(createdBody.data.preferredTwoFactorMethod, "sms");
    assert.equal(createdBody.data.role, "user");
    assert.equal(createdBody.data.totpEnrollmentPromptPending, true);
    assert.equal(createdBody.data.twoFactorEnabled, true);

    const listResponse = await app.request(
      `/api/users?q=${encodeURIComponent(createPayload.email)}&role=user`,
      {
        method: "GET",
        headers: adminSession.headers,
      },
    );
    assert.equal(listResponse.status, 200);

    const listBody = (await listResponse.json()) as {
      data: {
        activeSessionCount: number;
        email: string;
        hasPasswordCredential: boolean;
        id: string;
        phoneNumber: string | null;
      }[];
      pagination: { total: number };
    };
    assert.ok(listBody.data.some((currentUser) => currentUser.id === createdBody.data.id));
    assert.ok(listBody.data.every((currentUser) => currentUser.hasPasswordCredential));
    assert.ok(
      listBody.data.some((currentUser) => currentUser.phoneNumber === normalizedPhoneNumber),
    );
    assert.ok(listBody.pagination.total >= 1);

    const getResponse = await app.request(`/api/users/${createdBody.data.id}`, {
      method: "GET",
      headers: adminSession.headers,
    });
    assert.equal(getResponse.status, 200);

    const updateResponse = await app.request(`/api/users/${createdBody.data.id}`, {
      method: "PATCH",
      headers: adminSession.headers,
      body: JSON.stringify({
        emailVerified: true,
        name: "Senior Support Agent",
      }),
    });
    assert.equal(updateResponse.status, 200);

    const updateBody = (await updateResponse.json()) as {
      data: {
        activeSessionCount: number;
        emailVerified: boolean;
        hasPasswordCredential: boolean;
        name: string;
      };
    };
    assert.equal(updateBody.data.activeSessionCount, 0);
    assert.equal(updateBody.data.emailVerified, true);
    assert.equal(updateBody.data.hasPasswordCredential, true);
    assert.equal(updateBody.data.name, "Senior Support Agent");

    const roleResponse = await app.request(`/api/users/${createdBody.data.id}/role`, {
      method: "POST",
      headers: adminSession.headers,
      body: JSON.stringify({ role: "admin" }),
    });
    assert.equal(roleResponse.status, 200);

    const roleBody = (await roleResponse.json()) as {
      data: { role: string | null };
    };
    assert.equal(roleBody.data.role, "admin");
  });

  void it("lets admins ban, unban, rotate passwords, and manage sessions without exposing tokens", async () => {
    const adminSession = await createAuthenticatedSession(app, "admin");
    const managedPassword = "Passw0rd!";
    const createdUser = await createManagedUser(adminSession.headers, managedPassword);

    await db
      .update(user)
      .set({ twoFactorEnabled: false })
      .where(eq(user.id, createdUser.id));

    const managedSession = await signInWithEmailAndTwoFactor(
      app,
      createdUser.email,
      managedPassword,
    );

    const sessionsResponse = await app.request(`/api/users/${createdUser.id}/sessions`, {
      method: "GET",
      headers: adminSession.headers,
    });
    assert.equal(sessionsResponse.status, 200);

    const sessionsBody = (await sessionsResponse.json()) as {
      count: number;
      data: {
        createdAt: string;
        expiresAt: string;
        id: string;
        token?: string;
        userAgent: string | null;
      }[];
    };
    assert.ok(sessionsBody.count >= 1);
    assert.ok(sessionsBody.data[0].createdAt.length > 0);
    assert.ok(sessionsBody.data[0].expiresAt.length > 0);
    assert.equal("token" in sessionsBody.data[0], false);

    const revokeSingleResponse = await app.request(
      `/api/users/${createdUser.id}/sessions/${sessionsBody.data[0].id}/revoke`,
      {
        method: "POST",
        headers: adminSession.headers,
      },
    );
    assert.equal(revokeSingleResponse.status, 200);

    const bannedResponse = await app.request(`/api/users/${createdUser.id}/ban`, {
      method: "POST",
      headers: adminSession.headers,
      body: JSON.stringify({
        banReason: "Left shift",
        revokeSessions: true,
      }),
    });
    assert.equal(bannedResponse.status, 200);

    const bannedBody = (await bannedResponse.json()) as {
      data: { banned: boolean | null };
      sessionsRevoked: boolean;
    };
    assert.equal(bannedBody.data.banned, true);
    assert.equal(bannedBody.sessionsRevoked, true);

    const blockedResponse = await app.request("/api/transactions", {
      method: "GET",
      headers: managedSession.headers,
    });
    assert.equal(blockedResponse.status, 401);

    const unbanResponse = await app.request(`/api/users/${createdUser.id}/unban`, {
      method: "POST",
      headers: adminSession.headers,
    });
    assert.equal(unbanResponse.status, 200);

    const newPassword = "N3wPassw0rd!";
    const passwordResponse = await app.request(
      `/api/users/${createdUser.id}/password`,
      {
        method: "POST",
        headers: adminSession.headers,
        body: JSON.stringify({
          newPassword,
          revokeSessions: true,
        }),
      },
    );
    assert.equal(passwordResponse.status, 200);

    const passwordBody = (await passwordResponse.json()) as {
      sessionsRevoked: boolean;
      status: boolean;
    };
    assert.equal(passwordBody.status, true);
    assert.equal(passwordBody.sessionsRevoked, true);

    const refreshedSession = await signInWithEmailAndTwoFactor(
      app,
      createdUser.email,
      newPassword,
    );
    const revokeAllResponse = await app.request(
      `/api/users/${createdUser.id}/sessions/revoke-all`,
      {
        method: "POST",
        headers: adminSession.headers,
      },
    );
    assert.equal(revokeAllResponse.status, 200);

    const revokedSessionResponse = await app.request("/api/transactions", {
      method: "GET",
      headers: refreshedSession.headers,
    });
    assert.equal(revokedSessionResponse.status, 401);
  });
});

async function createManagedUser(
  headers: Record<string, string>,
  password: string,
) {
  const email = `${uniqueRef("managed")}@gmail.com`;
  const phoneNumber = uniqueKenyanPhoneNumber();
  const response = await app.request("/api/users", {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      name: "Managed User",
      phoneNumber,
      password,
      role: "user",
    }),
  });

  assert.equal(response.status, 201);
  const body = (await response.json()) as {
    data: { email: string; hasPasswordCredential: boolean; id: string };
  };
  assert.equal(body.data.hasPasswordCredential, true);
  return body.data;
}
