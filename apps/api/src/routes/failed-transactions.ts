import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { failedTransactions } from "../db/schema";
import { requireAdmin, type AppBindings } from "../lib/auth-middleware";
import {
  failedTransactionIdParamSchema,
  failedTransactionListQuerySchema,
  failedTransactionUpdateSchema,
} from "../validators/failed-transactions";
import { extractClientIp, writeAuditLog } from "../services/audit-log.service";

export const failedTransactionRoutes = new Hono<AppBindings>();

failedTransactionRoutes.use("*", requireAdmin);

failedTransactionRoutes.get(
  "/",
  zValidator("query", failedTransactionListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const conditions = [];

    if (query.status) {
      conditions.push(eq(failedTransactions.status, query.status));
    }
    if (query.failureReason) {
      conditions.push(eq(failedTransactions.failureReason, query.failureReason));
    }

    const rows = await db.query.failedTransactions.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(failedTransactions.createdAt)],
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
      with: {
        mpesaTransaction: {
          columns: {
            id: true,
            transId: true,
            billRefNumber: true,
            transAmount: true,
            msisdn: true,
            createdAt: true,
          },
        },
      },
    });

    return c.json({ data: rows, count: rows.length });
  }
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
      columns: { id: true, status: true },
    });
    if (!existing) {
      return c.json({ error: "Failed transaction not found" }, 404);
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
        previousStatus: existing.status,
        newStatus: body.status,
        resolutionNotes: body.resolutionNotes ?? null,
      },
      ipAddress: extractClientIp(c.req.raw.headers),
    });

    return c.json({ data: updated });
  }
);

function toOptionalUuid(value: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
    ? value
    : null;
}
