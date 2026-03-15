import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { smsLogs } from "../db/schema";
import type { AppBindings } from "../lib/auth-middleware";
import { requirePermission } from "../lib/auth-middleware";
import { ensureAdminRouteAccess } from "../lib/staff-route-access";
import { redactTokensInText } from "../lib/token-redaction";
import { getSmsProviderHealthSummary } from "../services/sms-provider-health.service";
import { queueSmsRetryById } from "../services/sms-recovery.service";
import { sendSms } from "../services/sms.service";

const smsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const idParamSchema = z.object({
  id: z.uuid(),
});

const providerHealthQuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(168).optional(),
});

const testSmsSchema = z.object({
  message: z.string().min(1).max(160),
  phoneNumber: z.string().min(10),
});

export const smsRoutes = new Hono<AppBindings>();

smsRoutes.get(
  "/",
  requirePermission("sms:read"),
  zValidator("query", smsListQuerySchema),
  async (c) => {
    ensureAdminRouteAccess(c.get("user"), "Broad SMS log listing");

    const query = c.req.valid("query");
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const logs = await db
      .select()
      .from(smsLogs)
      .orderBy(desc(smsLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({
      data: logs.map((log) => ({
        ...log,
        messageBody: redactTokensInText(log.messageBody),
      })),
      pagination: {
        count: logs.length,
        limit,
        offset,
      },
    });
  },
);

smsRoutes.get(
  "/provider-health",
  requirePermission("sms:read"),
  zValidator("query", providerHealthQuerySchema),
  async (c) => {
    const { hours } = c.req.valid("query");
    const summary = await getSmsProviderHealthSummary(hours ?? 24);

    return c.json({ data: summary });
  },
);

smsRoutes.get(
  "/:id",
  requirePermission("sms:read"),
  zValidator("param", idParamSchema),
  async (c) => {
    ensureAdminRouteAccess(c.get("user"), "Direct SMS log detail access");

    const { id } = c.req.valid("param");
    const log = await db
      .select()
      .from(smsLogs)
      .where(eq(smsLogs.id, id))
      .limit(1);

    if (!log.length) {
      return c.json({ error: "SMS log not found" }, 404);
    }

    return c.json({
      data: {
        ...log[0],
        messageBody: redactTokensInText(log[0].messageBody),
      },
    });
  },
);

smsRoutes.post(
  "/resend/:id",
  requirePermission("sms:resend"),
  zValidator("param", idParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const result = await queueSmsRetryById(id);

    return c.json({
      jobId: result.jobId,
      message: "SMS resend queued",
      smsLogId: result.smsLogId,
    });
  },
);

smsRoutes.post(
  "/test",
  requirePermission("sms:test"),
  zValidator("json", testSmsSchema),
  async (c) => {
    const { phoneNumber, message } = c.req.valid("json");
    console.log(`[SMS Test] Sending to ${phoneNumber}`);

    const result = await sendSms(phoneNumber, message);

    return c.json({
      cost: result.cost,
      error: result.error,
      messageId: result.messageId,
      provider: result.provider,
      success: result.success,
    });
  },
);
