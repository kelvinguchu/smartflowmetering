import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db";
import { smsLogs } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { smsDeliveryQueue } from "../queues";
import { sendSms } from "../services/sms.service";
import { requireAdmin, type AppBindings } from "../lib/auth-middleware";

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
  requireAdmin,
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
      data: logs,
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
  requireAdmin,
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

    return c.json({ data: log[0] });
  },
);

smsRoutes.post(
  "/resend/:id",
  requireAdmin,
  zValidator("param", idParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const [log] = await db
      .select()
      .from(smsLogs)
      .where(eq(smsLogs.id, id))
      .limit(1);

    if (!log) {
      return c.json({ error: "SMS log not found" }, 404);
    }

    const job = await smsDeliveryQueue.add(
      "sms-resend",
      {
        kind: "resend" as const,
        smsLogId: log.id,
        phoneNumber: log.phoneNumber,
        messageBody: log.messageBody,
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    );

    return c.json({
      message: "SMS resend queued",
      jobId: job.id,
      smsLogId: log.id,
    });
  },
);

smsRoutes.post(
  "/test",
  requireAdmin,
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
