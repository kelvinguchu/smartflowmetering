import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../lib/auth-middleware";
import { requirePermission } from "../lib/auth-middleware";
import { syncSmsDeliveryStatusById } from "../services/sms-recovery-sync.service";
import {
  listSmsRecoveryEntries,
  queueSmsRetryById,
} from "../services/sms-recovery.service";
import {
  smsRecoveryListQuerySchema,
  smsRecoveryRetryBatchSchema,
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
    const query = c.req.valid("query");
    const result = await listSmsRecoveryEntries(query);
    return c.json({
      data: result.items,
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
  async (c) => {
    const { id } = c.req.valid("param");
    const result = await syncSmsDeliveryStatusById(id);
    return c.json({
      message: result.synced
        ? "SMS delivery status synced"
        : "No TextSMS delivery report available yet",
      ...result,
    });
  },
);

smsRecoveryRoutes.post(
  "/:id/retry",
  requirePermission("sms:resend"),
  zValidator("param", idParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const result = await queueSmsRetryById(id);
    return c.json({
      message: "SMS retry queued",
      ...result,
    });
  },
);

smsRecoveryRoutes.post(
  "/retry-batch",
  requirePermission("sms:resend"),
  zValidator("json", smsRecoveryRetryBatchSchema),
  async (c) => {
    const { ids } = c.req.valid("json");
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          return { id, ok: true as const, ...(await queueSmsRetryById(id)) };
        } catch (error) {
          return {
            id,
            message: error instanceof Error ? error.message : "Unknown retry error",
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
