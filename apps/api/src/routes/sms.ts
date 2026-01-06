import { Elysia, t } from "elysia";
import { db } from "../db";
import { smsLogs } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { smsDeliveryQueue } from "../queues";
import { sendSms } from "../services/sms.service";
import { authMiddleware } from "../lib/auth-middleware";

/**
 * SMS Routes
 *
 * Routes for SMS management and testing:
 * - GET /sms - List SMS logs
 * - GET /sms/:id - Get SMS log details
 * - POST /sms/resend/:id - Resend a failed SMS
 * - POST /sms/test - Send a test SMS (development only)
 */
export const smsRoutes = new Elysia({ prefix: "/sms" })
  .use(authMiddleware)

  /**
   * List SMS logs with pagination (adminOnly)
   */
  .get(
    "/",
    async ({ query }) => {
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;

      const logs = await db
        .select()
        .from(smsLogs)
        .orderBy(desc(smsLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        data: logs,
        pagination: {
          limit,
          offset,
          count: logs.length,
        },
      };
    },
    {
      query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
      }),
      detail: {
        summary: "List SMS logs",
        tags: ["SMS"],
      },
      adminOnly: true,
    }
  )

  /**
   * Get SMS log details by ID
   */
  .get(
    "/:id",
    async ({ params, set }) => {
      const log = await db
        .select()
        .from(smsLogs)
        .where(eq(smsLogs.id, params.id))
        .limit(1);

      if (!log.length) {
        set.status = 404;
        return { error: "SMS log not found" };
      }

      return { data: log[0] };
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Get SMS log details",
        tags: ["SMS"],
      },
      adminOnly: true,
    }
  )

  /**
   * Resend a failed SMS
   */
  .post(
    "/resend/:id",
    async ({ params, set }) => {
      // Find the SMS log
      const [log] = await db
        .select()
        .from(smsLogs)
        .where(eq(smsLogs.id, params.id))
        .limit(1);

      if (!log) {
        set.status = 404;
        return { error: "SMS log not found" };
      }

      // Queue the resend job
      const job = await smsDeliveryQueue.add(
        "sms-resend",
        {
          smsLogId: log.id,
          phoneNumber: log.phoneNumber,
          messageBody: log.messageBody,
        },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
        }
      );

      return {
        message: "SMS resend queued",
        jobId: job.id,
        smsLogId: log.id,
      };
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Resend a failed SMS",
        tags: ["SMS"],
      },
      adminOnly: true,
    }
  )

  /**
   * Send a test SMS (development/testing only)
   */
  .post(
    "/test",
    async ({ body }) => {
      const { phoneNumber, message } = body;

      console.log(`[SMS Test] Sending to ${phoneNumber}`);

      const result = await sendSms(phoneNumber, message);

      return {
        success: result.success,
        messageId: result.messageId,
        cost: result.cost,
        provider: result.provider,
        error: result.error,
      };
    },
    {
      body: t.Object({
        phoneNumber: t.String({ minLength: 10 }),
        message: t.String({ minLength: 1, maxLength: 160 }),
      }),
      detail: {
        summary: "Send a test SMS",
        description: "Send a test SMS message directly (bypasses queue)",
        tags: ["SMS"],
      },
      adminOnly: true,
    }
  );
