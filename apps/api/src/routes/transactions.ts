import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { db } from "../db";
import { generatedTokens, meters, smsLogs, transactions } from "../db/schema";
import type { AppBindings } from "../lib/auth-middleware";
import { requirePermission } from "../lib/auth-middleware";
import { ensureAdminRouteAccess, ensureSupportScopedTransactionSearch, isAdminStaffUser } from "../lib/staff-route-access";
import { revealToken } from "../lib/token-protection";
import { redactTokensInText } from "../lib/token-redaction";
import { smsDeliveryQueue } from "../queues";
import { toTransactionDetail, toTransactionListItem } from "../services/transaction-response.service";
import { formatTokenSms } from "../services/sms/sms.service";
import { type TransactionQuery, resendTokenSchema, transactionQuerySchema } from "../validators/transactions";

const idParamSchema = z.object({
  id: z.uuid(),
});

const transactionIdParamSchema = z.object({ transactionId: z.string() });

export const transactionRoutes = new Hono<AppBindings>();

transactionRoutes.get(
  "/",
  requirePermission("transactions:read"),
  zValidator("query", transactionQuerySchema),
  async (c) => {
    const actor = c.get("user");
    const query = c.req.valid("query");
    ensureSupportScopedTransactionSearch(actor, query);

    const conditions = await buildTransactionFilters(query);
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
      limit: isAdminStaffUser(actor) ? (query.limit ?? 20) : Math.min(query.limit ?? 20, 20),
      offset: query.offset ?? 0,
    });

    return c.json({ count: result.length, data: result.map((transaction) =>
      toTransactionListItem(transaction, { includeFinancialBreakdown: isAdminStaffUser(actor) }),
    ) });
  },
);

transactionRoutes.get(
  "/:id",
  requirePermission("transactions:read"),
  zValidator("param", idParamSchema),
  async (c) => {
    ensureAdminRouteAccess(c.get("user"), "Direct transaction detail access");

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
        mpesaTransaction: true,
        smsLogs: true,
      },
    });

    if (!transaction) {
      return c.json({ error: "Transaction not found" }, 404);
    }

    return c.json({ data: toTransactionDetail(transaction) });
  },
);

transactionRoutes.get(
  "/reference/:transactionId",
  requirePermission("transactions:read"),
  zValidator("param", transactionIdParamSchema),
  async (c) => {
    ensureAdminRouteAccess(c.get("user"), "Direct transaction detail access");

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

    return c.json({ data: toTransactionListItem(transaction, { includeFinancialBreakdown: true }) });
  },
);

transactionRoutes.post(
  "/resend-token",
  requirePermission("transactions:resend_token"),
  zValidator("json", resendTokenSchema),
  async (c) => {
    const actor = c.get("user");
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
      .select({ token: generatedTokens.token, value: generatedTokens.value })
      .from(generatedTokens)
      .where(
        and(
          eq(generatedTokens.transactionId, transaction.id),
          eq(generatedTokens.tokenType, "credit"),
        ),
      )
      .orderBy(desc(generatedTokens.createdAt))
      .limit(1);

    if (!token) {
      return c.json({ error: "No token found for this transaction" }, 400);
    }

    const phoneNumber = resolveResendPhoneNumber({
      actor,
      requestedPhoneNumber: body.phoneNumber,
      transactionPhoneNumber: transaction.phoneNumber,
    });

    await smsDeliveryQueue.add(
      "resend-sms",
      {
        amount: transaction.amountPaid,
        meterNumber: transaction.meter.meterNumber,
        phoneNumber,
        token: revealToken(token.token),
        transactionId: transaction.id,
        units: token.value ?? "0",
      },
      {
        jobId: `sms-resend-${transaction.id}-${Date.now()}`,
      },
    );

    const [smsLog] = await db
      .insert(smsLogs)
      .values({
        messageBody: redactTokensInText(
          formatTokenSms({
            amountPaid: transaction.amountPaid,
            meterNumber: transaction.meter.meterNumber,
            otherCharges: transaction.commissionAmount,
            token: revealToken(token.token),
            tokenAmount: transaction.netAmount,
            transactionDate: transaction.completedAt ?? transaction.createdAt,
            units: token.value ?? "0",
          }),
        ),
        phoneNumber,
        provider: "hostpinnacle",
        status: "queued",
        transactionId: transaction.id,
      })
      .returning();

    return c.json({ message: "Token SMS queued for delivery", smsLogId: smsLog.id, success: true });
  },
);

transactionRoutes.get(
  "/stats/summary",
  requirePermission("transactions:summary"),
  async (c) => {
    const [stats] = await db
      .select({
        completed:
          sql<number>`count(*) filter (where ${transactions.status} = 'completed')::int`,
        failed:
          sql<number>`count(*) filter (where ${transactions.status} = 'failed')::int`,
        pending:
          sql<number>`count(*) filter (where ${transactions.status} = 'pending')::int`,
        processing:
          sql<number>`count(*) filter (where ${transactions.status} = 'processing')::int`,
        total: sql<number>`count(*)::int`,
        totalAmount:
          sql<string>`coalesce(sum(case when ${transactions.status} = 'completed' then ${transactions.amountPaid}::numeric else 0 end), 0)::text`,
        totalCommission:
          sql<string>`coalesce(sum(case when ${transactions.status} = 'completed' then ${transactions.commissionAmount}::numeric else 0 end), 0)::text`,
      })
      .from(transactions);

    return c.json({ data: stats });
  },
);

async function buildTransactionFilters(query: TransactionQuery) {
  const conditions = [];

  if (query.transactionId) {
    conditions.push(eq(transactions.transactionId, query.transactionId));
  }
  if (query.mpesaReceiptNumber) {
    conditions.push(eq(transactions.mpesaReceiptNumber, query.mpesaReceiptNumber));
  }
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
  if (!query.meterNumber) {
    return conditions;
  }

  const meter = await db.query.meters.findFirst({
    where: eq(meters.meterNumber, query.meterNumber),
    columns: { id: true },
  });
  if (!meter) {
    return [sql`false`];
  }

  conditions.push(eq(transactions.meterId, meter.id));
  return conditions;
}

function resolveResendPhoneNumber(input: {
  actor: AppBindings["Variables"]["user"];
  requestedPhoneNumber: string | undefined;
  transactionPhoneNumber: string;
}): string {
  if (isAdminStaffUser(input.actor)) {
    return input.requestedPhoneNumber ?? input.transactionPhoneNumber;
  }
  if (
    input.requestedPhoneNumber &&
    input.requestedPhoneNumber !== input.transactionPhoneNumber
  ) {
    throw new HTTPException(403, {
      message:
        "Forbidden: Support staff can only resend to the original transaction phone number",
    });
  }

  return input.transactionPhoneNumber;
}

