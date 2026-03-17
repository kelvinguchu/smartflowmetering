import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppBindings } from "../lib/auth-middleware";
import { requirePermission } from "../lib/auth-middleware";
import {
  ensureSupportScopedRecoveryLookup,
  isAdminStaffUser,
} from "../lib/staff-route-access";
import { findSupportRecovery } from "../services/support-recovery.service";
import { supportRecoveryQuerySchema } from "../validators/support-recovery";

export const supportRecoveryRoutes = new Hono<AppBindings>();

supportRecoveryRoutes.get(
  "/",
  requirePermission("support_recovery:read"),
  zValidator("query", supportRecoveryQuerySchema),
  async (c) => {
    const actor = c.get("user");
    const query = c.req.valid("query");
    ensureSupportScopedRecoveryLookup(actor, query, "support recovery");
    const result = await findSupportRecovery(query, {
      includeAdminTokens: isAdminStaffUser(actor),
    });
    return c.json({ data: result });
  },
);
