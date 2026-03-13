import { desc, eq } from "drizzle-orm";
import assert from "node:assert/strict";
import type { App } from "../../src/app";
import { db } from "../../src/db";
import { verification } from "../../src/db/schema";

export async function signInWithEmailAndTwoFactor(
  app: App,
  email: string,
  password: string,
) {
  const signInResponse = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  assert.equal(signInResponse.status, 200);

  const initialCookies = extractAuthCookies(signInResponse.headers.get("set-cookie"));
  const signInBody = (await signInResponse.json()) as {
    twoFactorRedirect?: boolean;
  };

  if (!signInBody.twoFactorRedirect) {
    return { headers: buildSessionHeaders(initialCookies) };
  }

  const sendOtpResponse = await app.request("/api/auth/two-factor/send-otp", {
    method: "POST",
    headers: buildSessionHeaders(initialCookies),
  });
  assert.ok(
    sendOtpResponse.status === 200 || sendOtpResponse.status === 403,
    `Expected send-otp to succeed or reuse an existing challenge, got ${sendOtpResponse.status}`,
  );

  const otp = await findLatestTwoFactorOtp();
  const verifyOtpResponse = await app.request("/api/auth/two-factor/verify-otp", {
    method: "POST",
    headers: buildSessionHeaders(initialCookies),
    body: JSON.stringify({ code: otp }),
  });

  assert.equal(verifyOtpResponse.status, 200);

  const verifiedCookies = extractAuthCookies(verifyOtpResponse.headers.get("set-cookie"));
  return { headers: buildSessionHeaders(verifiedCookies) };
}

function buildSessionHeaders(cookie: string): Record<string, string> {
  return {
    cookie,
    "Content-Type": "application/json",
  };
}

function extractAuthCookies(rawCookieHeader: string | null): string {
  assert.ok(rawCookieHeader, "Expected Better Auth to return cookies");

  const sessionTokenCookie =
    /better-auth\.session_token=[^;]+/.exec(rawCookieHeader)?.[0] ?? "";
  const sessionDataCookie =
    /better-auth\.session_data=[^;]+/.exec(rawCookieHeader)?.[0] ?? "";
  const twoFactorCookie =
    /better-auth\.two_factor=[^;]+/.exec(rawCookieHeader)?.[0] ?? "";

  const cookie = [sessionTokenCookie, sessionDataCookie, twoFactorCookie]
    .filter(Boolean)
    .join("; ");

  assert.ok(cookie, "Expected auth cookies to be extracted");
  return cookie;
}

async function findLatestTwoFactorOtp(): Promise<string> {
  const latestVerification = await db.query.verification.findFirst({
    where: eq(verification.identifier, "2fa-otp"),
    orderBy: desc(verification.createdAt),
    columns: { value: true },
  });

  if (latestVerification?.value) {
    return latestVerification.value.split(":")[0];
  }

  const fallbackVerification = await db.query.verification.findFirst({
    orderBy: desc(verification.createdAt),
    columns: {
      identifier: true,
      value: true,
    },
  });

  assert.ok(
    fallbackVerification?.identifier.startsWith("2fa-otp-") === true,
    "Expected a pending 2FA OTP verification record",
  );

  return fallbackVerification.value.split(":")[0];
}
