import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppBindings } from "../lib/auth-middleware";
import { requirePermission } from "../lib/auth-middleware";
import { extractClientIp, writeAuditLog } from "../services/audit-log.service";
import {
  listCustomerPromptCandidates,
  queueCustomerPrompts,
} from "../services/customer-prompts.service";
import {
  customerPromptListQuerySchema,
  customerPromptQueueSchema,
} from "../validators/customer-prompts";

export const customerPromptRoutes = new Hono<AppBindings>();

customerPromptRoutes.use("*", requirePermission("customer_prompts:manage"));

customerPromptRoutes.get(
  "/",
  zValidator("query", customerPromptListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await listCustomerPromptCandidates(query);

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

customerPromptRoutes.post(
  "/queue",
  zValidator("json", customerPromptQueueSchema),
  async (c) => {
    const body = c.req.valid("json");
    const authUser = c.get("user");
    const result = await queueCustomerPrompts(body);

    await writeAuditLog({
      userId: authUser.id,
      action: "customer_prompts_queued",
      entityType: "customer_prompt",
      entityId: body.type,
      details: {
        filters: body,
        summary: result,
      },
      ipAddress: extractClientIp(c.req.raw.headers),
    });

    return c.json({
      data: result,
      message: "Customer prompts queued",
    });
  },
);
