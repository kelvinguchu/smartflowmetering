import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../lib/auth-middleware";
import { requirePermission } from "../lib/auth-middleware";
import {
  ensureSupportScopedSmsRecoveryLookup,
  isAdminStaffUser,
  matchesSmsRecoveryScope,
} from "../lib/staff-route-access";
import { syncSmsDeliveryStatusById } from "../services/sms-recovery-sync.service";
import {
  getSmsRecoveryScopeTargetById,
  listSmsRecoveryEntries,
  listSmsRecoveryScopeTargetsByIds,
  queueSmsRetryById,
} from "../services/sms-recovery.service";
import type {
  SmsRecoveryItem,
  SmsRecoverySyncResult,
} from "../services/sms-recovery.types";
import {
  smsRecoveryListQuerySchema,
  smsRecoveryRetryBatchSchema,
  smsRecoveryScopeQuerySchema,
} from "../validators/sms-recovery";

const idParamSchema = z.object({
  id: z.uuid(),
});

export const smsRecoveryRoutes = new Hono<AppBindings>();

smsRecoveryRoutes.get(
  "/",
  requirePermission("sms:read"),
  zValidator("query", smsRecoveryListQuerySchema),
  async (c) => {
    const isAdmin = isAdminStaffUser(c.get("user"));
    const query = c.req.valid("query");
    const result = await listSmsRecoveryEntries(query);
    return c.json({
      data: result.items.map((item) => shapeSmsRecoveryItem(item, isAdmin)),
      pagination: {
        count: result.items.length,
        limit: query.limit ?? 50,
        offset: query.offset ?? 0,
      },
      summary: result.summary,
    });
  },
);

smsRecoveryRoutes.post(
  "/:id/sync-status",
  requirePermission("sms:read"),
  zValidator("param", idParamSchema),
  zValidator("query", smsRecoveryScopeQuerySchema),
  async (c) => {
    const actor = c.get("user");
    const isAdmin = isAdminStaffUser(actor);
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    ensureSupportScopedSmsRecoveryLookup(actor, query, "SMS recovery sync");
    const target = await getSmsRecoveryScopeTargetById(id);
    if (!target) {
      return c.json({ error: "SMS log not found" }, 404);
    }
    if (!isAdmin && !matchesSmsRecoveryScope(target, query)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const result = await syncSmsDeliveryStatusById(id);
    return c.json({
      message: result.synced
        ? "SMS delivery status synced"
        : "No TextSMS delivery report available yet",
      ...shapeSmsRecoverySyncResult(result, isAdmin),
    });
  },
);

smsRecoveryRoutes.post(
  "/:id/retry",
  requirePermission("sms:resend"),
  zValidator("param", idParamSchema),
  zValidator("query", smsRecoveryScopeQuerySchema),
  async (c) => {
    const actor = c.get("user");
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const isAdmin = isAdminStaffUser(actor);
    ensureSupportScopedSmsRecoveryLookup(actor, query, "SMS retry");
    const target = await getSmsRecoveryScopeTargetById(id);
    if (!target) {
      return c.json({ error: "SMS log not found" }, 404);
    }
    if (!isAdmin && !matchesSmsRecoveryScope(target, query)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const result = await queueSmsRetryById(id);
    return c.json({
      message: "SMS retry queued",
      ...result,
    });
  },
);

function shapeSmsRecoveryItem(
  item: SmsRecoveryItem,
  isAdmin: boolean,
): Omit<SmsRecoveryItem, "providerErrorCode" | "providerStatus"> &
  Partial<Pick<SmsRecoveryItem, "providerErrorCode" | "providerStatus">> {
  if (isAdmin) {
    return item;
  }

  return {
    createdAt: item.createdAt,
    id: item.id,
    messageBody: item.messageBody,
    phoneNumber: item.phoneNumber,
    provider: item.provider,
    retryEligible: item.retryEligible,
    status: item.status,
    transaction: item.transaction,
  };
}

function shapeSmsRecoverySyncResult(
  result: SmsRecoverySyncResult,
  isAdmin: boolean,
): Omit<SmsRecoverySyncResult, "provider" | "providerMessageId"> &
  Partial<Pick<SmsRecoverySyncResult, "provider" | "providerMessageId">> {
  if (isAdmin) {
    return result;
  }

  return {
    smsLogId: result.smsLogId,
    status: result.status,
    synced: result.synced,
  };
}

smsRecoveryRoutes.post(
  "/retry-batch",
  requirePermission("sms:resend"),
  zValidator("query", smsRecoveryScopeQuerySchema),
  zValidator("json", smsRecoveryRetryBatchSchema),
  async (c) => {
    const actor = c.get("user");
    const query = c.req.valid("query");
    const { ids } = c.req.valid("json");
    const isAdmin = isAdminStaffUser(actor);
    ensureSupportScopedSmsRecoveryLookup(actor, query, "batch SMS retry");
    if (!isAdmin) {
      const targets = await listSmsRecoveryScopeTargetsByIds(ids);
      if (targets.some((target) => !matchesSmsRecoveryScope(target, query))) {
        return c.json({ error: "Forbidden" }, 403);
      }
    }
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          return { id, ok: true as const, ...(await queueSmsRetryById(id)) };
        } catch (error) {
          return {
            id,
            message:
              error instanceof Error ? error.message : "Unknown retry error",
            ok: false as const,
          };
        }
      }),
    );

    return c.json({
      failed: results.filter((result) => !result.ok).length,
      queued: results.filter((result) => result.ok).length,
      results,
    });
  },
);
