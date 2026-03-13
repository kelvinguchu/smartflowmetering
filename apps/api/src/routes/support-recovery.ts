import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppBindings } from "../lib/auth-middleware";
import { requirePermission } from "../lib/auth-middleware";
import { findSupportRecovery } from "../services/support-recovery.service";
import { supportRecoveryQuerySchema } from "../validators/support-recovery";

export const supportRecoveryRoutes = new Hono<AppBindings>();

supportRecoveryRoutes.get(
  "/",
  requirePermission("support_recovery:read"),
  zValidator("query", supportRecoveryQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await findSupportRecovery(query);
    return c.json({ data: result });
  },
);
