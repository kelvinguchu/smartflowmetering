import { Hono, type Context } from "hono";
import type { AppBindings } from "../../lib/auth-middleware";
import { env } from "../../config";
import { getClientIP, isValidMpesaIP } from "../../lib/mpesa-validation";

export type MpesaRouter = Hono<AppBindings>;

export function rejectIfInvalidMpesaSource(
  c: Context<AppBindings>,
  label: string,
  payload: Record<string, string | number>
) {
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
    return tokenFromHeader === callbackToken;
  }

  if (env.MPESA_CALLBACK_TOKEN_TRANSPORT === "query") {
    return tokenFromQuery === callbackToken;
  }

  return tokenFromHeader === callbackToken || tokenFromQuery === callbackToken;
}
