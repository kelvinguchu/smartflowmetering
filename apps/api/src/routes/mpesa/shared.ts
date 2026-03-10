import { timingSafeEqual } from "node:crypto";
import { Hono, type Context } from "hono";
import type { AppBindings } from "../../lib/auth-middleware";
import { env } from "../../config";
import {
  getClientIP,
  isValidMpesaIP,
  validateMpesaSignature,
} from "../../lib/mpesa-validation";

export type MpesaRouter = Hono<AppBindings>;

export async function rejectIfInvalidMpesaSource(
  c: Context<AppBindings>,
  label: string,
  payload: Record<string, string | number>,
) {
  const signatureValidation = await validateMpesaSignature(c.req.raw);
  if (!signatureValidation.valid) {
    console.warn(
      `[${label}] Rejected: Invalid signature (${signatureValidation.reason ?? "unknown"})`,
    );
    return c.json(payload, 403);
  }

  if (!hasValidMpesaCallbackToken(c)) {
    console.warn(`[${label}] Rejected: Invalid callback token`);
    return c.json(payload, 403);
  }

  const clientIP = getClientIP(c.req.raw.headers);
  if (!isValidMpesaIP(clientIP)) {
    console.warn(`[${label}] Rejected: Invalid source IP ${clientIP}`);
    return c.json(payload, 403);
  }

  return null;
}

export function formatMpesaTimestamp(date = new Date()): string {
  return date.toISOString().replaceAll(/[-:T]/g, "").slice(0, 14);
}

function timingSafeCompare(a: string | null, b: string): boolean {
  if (!a) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.byteLength !== bufB.byteLength) return false;
  return timingSafeEqual(bufA, bufB);
}

function hasValidMpesaCallbackToken(c: Context<AppBindings>): boolean {
  if (env.NODE_ENV !== "production") return true;
  if (!env.MPESA_CALLBACK_TOKEN) return true;

  const callbackToken = env.MPESA_CALLBACK_TOKEN;
  const tokenFromHeader =
    c.req.header("x-mpesa-callback-token") ??
    c.req.header("x-callback-token") ??
    c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;

  const reqUrl = new URL(c.req.url);
  const tokenFromQuery =
    reqUrl.searchParams.get("callback_token") ??
    reqUrl.searchParams.get("token") ??
    null;

  if (env.MPESA_CALLBACK_TOKEN_TRANSPORT === "header") {
    return timingSafeCompare(tokenFromHeader, callbackToken);
  }

  if (env.MPESA_CALLBACK_TOKEN_TRANSPORT === "query") {
    return timingSafeCompare(tokenFromQuery, callbackToken);
  }

  return (
    timingSafeCompare(tokenFromHeader, callbackToken) ||
    timingSafeCompare(tokenFromQuery, callbackToken)
  );
}
