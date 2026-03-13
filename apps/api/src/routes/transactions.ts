import { zValidator } from "@hono/zod-validator";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { generatedTokens, meters, smsLogs, transactions } from "../db/schema";
import { requirePermission } from "../lib/auth-middleware";
import type { AppBindings } from "../lib/auth-middleware";
import { revealToken } from "../lib/token-protection";
import { maskToken, redactTokensInText } from "../lib/token-redaction";
import { smsDeliveryQueue } from "../queues";
import { formatTokenSms } from "../services/sms.service";
import {
  resendTokenSchema,
  transactionQuerySchema,
} from "../validators/transactions";

const idParamSchema = z.object({
  id: z.uuid(),
});

const transactionIdParamSchema = z.object({
  transactionId: z.string(),
});

export const transactionRoutes = new Hono<AppBindings>();

transactionRoutes.get(
  "/",
  requirePermission("transactions:read"),
  zValidator("query", transactionQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const conditions = [];

    if (query.meterId) {
      conditions.push(eq(transactions.meterId, query.meterId));
    }
    if (query.phoneNumber) {
      conditions.push(eq(transactions.phoneNumber, query.phoneNumber));
    }
    if (query.status) {
      conditions.push(eq(transactions.status, query.status));
    }
    if (query.startDate) {
      conditions.push(gte(transactions.createdAt, new Date(query.startDate)));
    }
    if (query.endDate) {
      conditions.push(lte(transactions.createdAt, new Date(query.endDate)));
    }

    if (query.meterNumber) {
      const meter = await db.query.meters.findFirst({
        where: eq(meters.meterNumber, query.meterNumber),
        columns: { id: true },
      });

      if (meter) {
        conditions.push(eq(transactions.meterId, meter.id));
      } else {
        return c.json({ data: [], count: 0 });
      }
    }

    const result = await db.query.transactions.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        meter: {
          columns: { id: true, meterNumber: true, meterType: true },
        },
        generatedTokens: {
          columns: { id: true, token: true, tokenType: true, value: true },
        },
      },
      orderBy: [desc(transactions.createdAt)],
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });

    return c.json({
      data: result.map((transaction) => ({
        ...transaction,
        generatedTokens: transaction.generatedTokens.map((token) => ({
          ...token,
          token: maskToken(revealToken(token.token)),
        })),
      })),
      count: result.length,
    });
  }
);

transactionRoutes.get(
  "/:id",
  requirePermission("transactions:read"),
  zValidator("param", idParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
      with: {
        meter: {
          with: {
            motherMeter: {
              columns: { id: true, motherMeterNumber: true },
            },
          },
        },
        generatedTokens: true,
        smsLogs: true,
        mpesaTransaction: true,
      },
    });

    if (!transaction) {
      return c.json({ error: "Transaction not found" }, 404);
    }

    return c.json({
      data: {
        ...transaction,
        generatedTokens: transaction.generatedTokens.map((token) => ({
          ...token,
          token: maskToken(revealToken(token.token)),
        })),
        smsLogs: transaction.smsLogs.map((smsLog) => ({
          ...smsLog,
          messageBody: redactTokensInText(smsLog.messageBody),
        })),
      },
    });
  }
);

transactionRoutes.get(
  "/reference/:transactionId",
  requirePermission("transactions:read"),
  zValidator("param", transactionIdParamSchema),
  async (c) => {
    const { transactionId } = c.req.valid("param");
    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.transactionId, transactionId),
      with: {
        meter: {
          columns: { id: true, meterNumber: true, meterType: true },
        },
        generatedTokens: {
          columns: { id: true, token: true, tokenType: true, value: true },
        },
      },
    });

    if (!transaction) {
      return c.json({ error: "Transaction not found" }, 404);
    }

    return c.json({
      data: {
        ...transaction,
        generatedTokens: transaction.generatedTokens.map((token) => ({
          ...token,
          token: maskToken(revealToken(token.token)),
        })),
      },
    });
  }
);

transactionRoutes.post(
  "/resend-token",
  requirePermission("transactions:resend_token"),
  zValidator("json", resendTokenSchema),
  async (c) => {
    const body = c.req.valid("json");
    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, body.transactionId),
      with: {
        meter: {
          columns: { meterNumber: true },
        },
      },
    });

    if (!transaction) {
      return c.json({ error: "Transaction not found" }, 404);
    }

    if (transaction.status !== "completed") {
      return c.json({ error: "Transaction not completed" }, 400);
    }

    const tokenRows = await db
      .select({
        token: generatedTokens.token,
        value: generatedTokens.value,
      })
      .from(generatedTokens)
      .where(
        and(
          eq(generatedTokens.transactionId, transaction.id),
          eq(generatedTokens.tokenType, "credit")
        )
      )
      .orderBy(desc(generatedTokens.createdAt))
      .limit(1);

    if (tokenRows.length === 0) {
      return c.json({ error: "No token found for this transaction" }, 400);
    }
    const token = tokenRows[0];
    const phoneNumber = body.phoneNumber ?? transaction.phoneNumber;

    await smsDeliveryQueue.add(
      "resend-sms",
      {
        transactionId: transaction.id,
        phoneNumber,
        meterNumber: transaction.meter.meterNumber,
        token: revealToken(token.token),
        units: token.value ?? "0",
        amount: transaction.amountPaid,
      },
      {
        jobId: `sms-resend-${transaction.id}-${Date.now()}`,
      }
    );

    const [smsLog] = await db
      .insert(smsLogs)
      .values({
        transactionId: transaction.id,
        phoneNumber,
        messageBody: redactTokensInText(
          formatTokenSms({
            meterNumber: transaction.meter.meterNumber,
            token: revealToken(token.token),
            transactionDate: transaction.completedAt ?? transaction.createdAt,
            units: token.value ?? "0",
            amountPaid: transaction.amountPaid,
            tokenAmount: transaction.netAmount,
            otherCharges: transaction.commissionAmount,
          })
        ),
        provider: "hostpinnacle",
        status: "queued",
      })
      .returning();

    return c.json({
      success: true,
      message: "Token SMS queued for delivery",
      smsLogId: smsLog.id,
    });
  }
);

transactionRoutes.get(
  "/stats/summary",
  requirePermission("transactions:summary"),
  async (c) => {
    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        pending:
          sql<number>`count(*) filter (where ${transactions.status} = 'pending')::int`,
        processing:
          sql<number>`count(*) filter (where ${transactions.status} = 'processing')::int`,
        completed:
          sql<number>`count(*) filter (where ${transactions.status} = 'completed')::int`,
        failed:
          sql<number>`count(*) filter (where ${transactions.status} = 'failed')::int`,
        totalAmount:
          sql<string>`coalesce(sum(case when ${transactions.status} = 'completed' then ${transactions.amountPaid}::numeric else 0 end), 0)::text`,
        totalCommission:
          sql<string>`coalesce(sum(case when ${transactions.status} = 'completed' then ${transactions.commissionAmount}::numeric else 0 end), 0)::text`,
      })
      .from(transactions);

    return c.json({
      data: stats,
    });
  },
);
