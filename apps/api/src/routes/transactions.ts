import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db";
import { transactions, meters, generatedTokens, smsLogs } from "../db/schema";
import {
  transactionQuerySchema,
  resendTokenSchema,
} from "../validators/transactions";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { smsDeliveryQueue } from "../queues";
import {
  requireAuth,
  requireAdmin,
  type AppBindings,
} from "../lib/auth-middleware";

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const transactionIdParamSchema = z.object({
  transactionId: z.string(),
});

export const transactionRoutes = new Hono<AppBindings>();

transactionRoutes.get(
  "/",
  requireAuth,
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

    return c.json({ data: result, count: result.length });
  }
);

transactionRoutes.get(
  "/:id",
  requireAuth,
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

    return c.json({ data: transaction });
  }
);

transactionRoutes.get(
  "/reference/:transactionId",
  requireAuth,
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

    return c.json({ data: transaction });
  }
);

transactionRoutes.post(
  "/resend-token",
  requireAuth,
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

    const [token] = await db
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

    if (!token) {
      return c.json({ error: "No token found for this transaction" }, 400);
    }
    const phoneNumber = body.phoneNumber ?? transaction.phoneNumber;

    await smsDeliveryQueue.add(
      "resend-sms",
      {
        transactionId: transaction.id,
        phoneNumber,
        meterNumber: transaction.meter.meterNumber,
        token: token.token,
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
        messageBody: `Token resend for meter ${transaction.meter.meterNumber}: ${token.token}`,
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

transactionRoutes.get("/stats/summary", requireAdmin, async (c) => {
  const allTransactions = await db.query.transactions.findMany({
    columns: { status: true, amountPaid: true, commissionAmount: true },
  });

  const stats = {
    total: allTransactions.length,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    totalAmount: 0,
    totalCommission: 0,
  };

  for (const tx of allTransactions) {
    if (tx.status === "pending") stats.pending += 1;
    if (tx.status === "processing") stats.processing += 1;
    if (tx.status === "completed") stats.completed += 1;
    if (tx.status === "failed") stats.failed += 1;

    if (tx.status === "completed") {
      stats.totalAmount += Number.parseFloat(tx.amountPaid);
      stats.totalCommission += Number.parseFloat(tx.commissionAmount);
    }
  }

  return c.json({
    data: {
      ...stats,
      totalAmount: stats.totalAmount.toFixed(2),
      totalCommission: stats.totalCommission.toFixed(2),
    },
  });
});
