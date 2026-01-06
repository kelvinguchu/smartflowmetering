import { Elysia, t } from "elysia";
import { db } from "../db";
import { transactions, meters, generatedTokens, smsLogs } from "../db/schema";
import {
  transactionQuerySchema,
  resendTokenSchema,
} from "../validators/transactions";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { smsDeliveryQueue } from "../queues";
import { authMiddleware } from "../lib/auth-middleware";

/**
 * Transaction Routes
 *
 * Handles:
 * - Transaction listing and lookup
 * - Transaction details with tokens
 * - Token resend functionality
 */
export const transactionRoutes = new Elysia({ prefix: "/transactions" })
  .use(authMiddleware)

  /**
   * List transactions with filters (requires auth)
   */
  .get(
    "/",
    async ({ query }) => {
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

      // If meterNumber provided, find meter first
      if (query.meterNumber) {
        const meter = await db.query.meters.findFirst({
          where: eq(meters.meterNumber, query.meterNumber),
          columns: { id: true },
        });
        if (meter) {
          conditions.push(eq(transactions.meterId, meter.id));
        } else {
          return { data: [], count: 0 };
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

      return { data: result, count: result.length };
    },
    {
      query: transactionQuerySchema,
      auth: true,
    }
  )

  /**
   * Get transaction by ID
   */
  .get(
    "/:id",
    async ({ params, set }) => {
      const transaction = await db.query.transactions.findFirst({
        where: eq(transactions.id, params.id),
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
        set.status = 404;
        return { error: "Transaction not found" };
      }

      return { data: transaction };
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      auth: true,
    }
  )

  /**
   * Get transaction by OHM transaction ID
   */
  .get(
    "/reference/:transactionId",
    async ({ params, set }) => {
      const transaction = await db.query.transactions.findFirst({
        where: eq(transactions.transactionId, params.transactionId),
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
        set.status = 404;
        return { error: "Transaction not found" };
      }

      return { data: transaction };
    },
    {
      params: t.Object({
        transactionId: t.String(),
      }),
      auth: true,
    }
  )

  /**
   * Resend token SMS
   */
  .post(
    "/resend-token",
    async ({ body, set }) => {
      // Find the transaction
      const transaction = await db.query.transactions.findFirst({
        where: eq(transactions.id, body.transactionId),
        with: {
          meter: {
            columns: { meterNumber: true },
          },
          generatedTokens: {
            where: eq(generatedTokens.tokenType, "credit"),
            limit: 1,
            orderBy: (tokens: any, { desc }: any) => [desc(tokens.createdAt)],
          },
        },
      });

      if (!transaction) {
        set.status = 404;
        return { error: "Transaction not found" };
      }

      if (transaction.status !== "completed") {
        set.status = 400;
        return { error: "Transaction not completed" };
      }

      if (transaction.generatedTokens.length === 0) {
        set.status = 400;
        return { error: "No token found for this transaction" };
      }

      const token = transaction.generatedTokens[0];
      const phoneNumber = body.phoneNumber ?? transaction.phoneNumber;

      // Queue SMS delivery
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

      // Log the resend request
      const [smsLog] = await db
        .insert(smsLogs)
        .values({
          transactionId: transaction.id,
          phoneNumber,
          messageBody: `Token resend for meter ${transaction.meter.meterNumber}: ${token.token}`,
          provider: "africastalking",
          status: "queued",
        })
        .returning();

      return {
        success: true,
        message: "Token SMS queued for delivery",
        smsLogId: smsLog.id,
      };
    },
    {
      body: resendTokenSchema,
      auth: true,  // Users can resend tokens to customers
    }
  )

  /**
   * Get transaction statistics
   */
  .get("/stats/summary", async () => {
    // Get counts by status
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
      stats[tx.status as keyof typeof stats]++;
      if (tx.status === "completed") {
        stats.totalAmount += Number.parseFloat(tx.amountPaid);
        stats.totalCommission += Number.parseFloat(tx.commissionAmount);
      }
    }

    return {
      data: {
        ...stats,
        totalAmount: stats.totalAmount.toFixed(2),
        totalCommission: stats.totalCommission.toFixed(2),
      },
    };
  }, { adminOnly: true });
