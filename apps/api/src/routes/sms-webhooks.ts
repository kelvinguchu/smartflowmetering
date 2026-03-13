import { Hono } from "hono";
import type { Context } from "hono";
import { env } from "../config";
import type { AppBindings } from "../lib/auth-middleware";
import { maskPhoneForLog } from "../lib/log-redaction";
import {
  hasValidHostpinnacleWebhookToken,
  processHostpinnacleDlr,
} from "../services/sms-dlr.service";

export const smsWebhookRoutes = new Hono<AppBindings>();

smsWebhookRoutes.get("/hostpinnacle/dlr", async (c) => {
  return handleHostpinnacleDlr(c);
});

smsWebhookRoutes.post("/hostpinnacle/dlr", async (c) => {
  return handleHostpinnacleDlr(c);
});

async function handleHostpinnacleDlr(c: Context<AppBindings>) {
  const webhookHeader = c.req.header(env.HOSTPINNACLE_DLR_WEBHOOK_HEADER) ?? null;
  if (!hasValidHostpinnacleWebhookToken(webhookHeader)) {
    console.warn("[HostPinnacle DLR] Rejected: Invalid webhook token");
    return c.json({ error: "Forbidden" }, 403);
  }

  const payload = await readWebhookPayload(c);
  const mobileNumber = firstDefined(payload, ["mobileNumber", "mobile", "msisdn", "phone"]);
  const result = await processHostpinnacleDlr({
    deliveredTime: firstDefined(payload, ["deliveredTime", "delivered_time"]),
    errorCode: firstDefined(payload, ["errorCode", "error_code"]),
    messageId: firstDefined(payload, ["messageId", "message_id", "msgid"]),
    mobileNumber,
    rawStatus: firstDefined(payload, ["status", "deliveryStatus", "delivery_status"]),
    receivedTime: firstDefined(payload, ["receivedTime", "received_time"]),
    transactionId: firstDefined(payload, ["transactionId", "transaction_id"]),
  });

  console.log(
    `[HostPinnacle DLR] ${result.matched ? "Matched" : "Unmatched"} message for ${mobileNumber ? maskPhoneForLog(mobileNumber) : "unknown phone"}`,
  );

  return c.json({
    accepted: true,
    matched: result.matched,
    smsLogId: result.smsLogId,
    status: result.status,
  });
}

async function readWebhookPayload(c: Context<AppBindings>) {
  const request = c.req.raw;
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  let body: Record<string, string> = {};
  if (contentType.includes("application/json")) {
    body = normalizeJsonPayload(await request.text());
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const parsed = await c.req.parseBody();
    body = Object.fromEntries(
      Object.entries(parsed).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value]] : [],
      ),
    );
  }

  const query = Object.fromEntries(new URL(c.req.url).searchParams.entries());
  return { ...query, ...body };
}

function normalizeJsonPayload(rawBody: string): Record<string, string> {
  if (!rawBody.trim()) {
    return {};
  }

  let parsed: JsonObject;
  try {
    parsed = JSON.parse(rawBody) as JsonObject;
  } catch {
    return {};
  }

  return Object.fromEntries(
    Object.entries(parsed).flatMap(([key, currentValue]) =>
      typeof currentValue === "string" || typeof currentValue === "number"
        ? [[key, String(currentValue)]]
        : [],
    ),
  );
}

function firstDefined(
  payload: Record<string, string>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (value) {
      return value;
    }
  }
  return undefined;
}

interface JsonObject {
  [key: string]:
    | boolean
    | JsonObject
    | JsonObject[]
    | null
    | number
    | string
    | string[];
}
