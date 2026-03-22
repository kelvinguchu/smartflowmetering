import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppBindings } from "../../lib/auth-middleware";
import { requirePermission } from "../../lib/auth-middleware";
import { ensureAdminRouteAccess } from "../../lib/staff-route-access";
import { getAuditLog, listAuditLogs } from "../../services/admin/audit-log-read.service";
import {
  auditLogIdParamSchema,
  auditLogListQuerySchema,
} from "../../validators/audit-logs";

export const auditLogRoutes = new Hono<AppBindings>();

auditLogRoutes.use("*", requirePermission("audit_logs:read"));
auditLogRoutes.use("*", async (c, next) => {
  ensureAdminRouteAccess(c.get("user"), "Audit log access");
  await next();
});

auditLogRoutes.get(
  "/",
  zValidator("query", auditLogListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await listAuditLogs(query);

    return c.json({
      data: result.logs,
      pagination: {
        limit: query.limit ?? 50,
        offset: query.offset ?? 0,
        total: result.total,
      },
    });
  },
);

auditLogRoutes.get(
  "/:id",
  zValidator("param", auditLogIdParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const result = await getAuditLog(id);
    return c.json({ data: result });
  },
);




