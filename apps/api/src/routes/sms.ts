import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { smsLogs } from "../db/schema";
import { requirePermission } from "../lib/auth-middleware";
import type { AppBindings } from "../lib/auth-middleware";
import { redactTokensInText } from "../lib/token-redaction";
import { queueSmsRetryById } from "../services/sms-recovery.service";
import { sendSms } from "../services/sms.service";

const smsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const idParamSchema = z.object({
  id: z.uuid(),
});

const testSmsSchema = z.object({
  phoneNumber: z.string().min(10),
  message: z.string().min(1).max(160),
});

export const smsRoutes = new Hono<AppBindings>();

smsRoutes.get(
  "/",
  requirePermission("sms:read"),
  zValidator("query", smsListQuerySchema),
  async (c) => {
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
        limit,
        offset,
        count: logs.length,
      },
    });
  },
);

smsRoutes.get(
  "/:id",
  requirePermission("sms:read"),
  zValidator("param", idParamSchema),
  async (c) => {
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
      message: "SMS resend queued",
      jobId: result.jobId,
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
      success: result.success,
      messageId: result.messageId,
      cost: result.cost,
      provider: result.provider,
      error: result.error,
    });
  },
);
