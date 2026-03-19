import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { failedTransactions } from "../db/schema";
import { HTTPException } from "hono/http-exception";
import type { AppBindings } from "../lib/auth-middleware";
import { requirePermission } from "../lib/auth-middleware";
import { ensureSupportPendingQueueAccess } from "../lib/staff-route-access";
import { extractClientIp, writeAuditLog } from "../services/audit-log.service";
import {
  getFailedTransactionGuidance,
  validateFailedTransactionStatusUpdate,
} from "../services/failed-transaction-policy.service";
import { parseGomelongFailureDetails } from "../services/meter-providers/gomelong-failure-policy";
import {
  failedTransactionIdParamSchema,
  failedTransactionListQuerySchema,
  failedTransactionUpdateSchema,
} from "../validators/failed-transactions";

export const failedTransactionRoutes = new Hono<AppBindings>();

failedTransactionRoutes.use(
  "*",
  requirePermission("failed_transactions:manage"),
);

failedTransactionRoutes.get(
  "/",
  zValidator("query", failedTransactionListQuerySchema),
  async (c) => {
    const actor = c.get("user");
    const query = c.req.valid("query");
    ensureSupportPendingQueueAccess(actor, query.status, {
      pendingStatus: "pending_review",
      workflow: "failed transactions",
    });

    const effectiveStatus =
      actor.role === "admin" || query.status ? query.status : "pending_review";
    const conditions = [];

    if (effectiveStatus) {
      conditions.push(eq(failedTransactions.status, effectiveStatus));
    }
    if (query.failureReason) {
      conditions.push(
        eq(failedTransactions.failureReason, query.failureReason),
      );
    }

    const rows = await db.query.failedTransactions.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(failedTransactions.createdAt)],
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
      with: {
        mpesaTransaction: {
          columns: {
            transId: true,
            billRefNumber: true,
            transAmount: true,
            createdAt: true,
          },
        },
      },
    });

    return c.json({
      count: rows.length,
      data: rows.map((row) => {
        const guidance = getFailedTransactionGuidance(row.failureReason);

        return {
          amount: row.amount,
          createdAt: row.createdAt,
          failureDetails: row.failureDetails,
          failureReason: row.failureReason,
          guidance,
          id: row.id,
          meterNumberAttempted: row.meterNumberAttempted,
          providerFailure:
            row.failureReason === "manufacturer_error"
              ? parseGomelongFailureDetails(row.failureDetails)
              : null,
          payment: row.mpesaTransaction
            ? {
                amount: row.mpesaTransaction.transAmount,
                billRefNumber: row.mpesaTransaction.billRefNumber,
                createdAt: row.mpesaTransaction.createdAt,
                receiptNumber: row.mpesaTransaction.transId,
              }
            : null,
          phoneNumber: row.phoneNumber,
          resolutionNotes: row.resolutionNotes,
          resolvedAt: row.resolvedAt,
          status: row.status,
        };
      }),
    });
  },
);

failedTransactionRoutes.patch(
  "/:id/status",
  zValidator("param", failedTransactionIdParamSchema),
  zValidator("json", failedTransactionUpdateSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const authUser = c.get("user");

    const existing = await db.query.failedTransactions.findFirst({
      where: eq(failedTransactions.id, id),
      columns: { failureReason: true, id: true, status: true },
    });
    if (!existing) {
      return c.json({ error: "Failed transaction not found" }, 404);
    }

    const validation = validateFailedTransactionStatusUpdate({
      failureReason: existing.failureReason,
      nextStatus: body.status,
      previousStatus: existing.status,
      resolutionAction: body.resolutionAction,
      resolutionNotes: body.resolutionNotes,
    });
    if (!validation.ok) {
      throw new HTTPException(400, {
        message: validation.message,
      });
    }

    const resolvedBy =
      body.status === "pending_review" ? null : toOptionalUuid(authUser.id);
    const resolvedAt = body.status === "pending_review" ? null : new Date();

    const [updated] = await db
      .update(failedTransactions)
      .set({
        status: body.status,
        resolutionNotes: body.resolutionNotes ?? null,
        resolvedBy,
        resolvedAt,
      })
      .where(eq(failedTransactions.id, id))
      .returning();

    await writeAuditLog({
      userId: authUser.id,
      action: "failed_transaction_status_updated",
      entityType: "failed_transaction",
      entityId: id,
      details: {
        failureReason: existing.failureReason,
        previousStatus: existing.status,
        newStatus: body.status,
        resolutionAction: body.resolutionAction ?? null,
        resolutionNotes: body.resolutionNotes ?? null,
      },
      ipAddress: extractClientIp(c.req.raw.headers),
    });

    return c.json({ data: updated });
  },
);

function toOptionalUuid(value: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
    ? value
    : null;
}
