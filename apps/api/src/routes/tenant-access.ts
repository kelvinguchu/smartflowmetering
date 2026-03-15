import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { toMobileCollectionResponse } from "../lib/mobile-collection-response";
import type { TenantAppBindings } from "../lib/tenant-access-middleware";
import { requireTenantAccess } from "../lib/tenant-access-middleware";
import {
  upsertTenantDeviceToken,
} from "../services/customer-device-tokens.service";
import {
  acknowledgeTenantTokenDelivery,
  bootstrapTenantAccess,
  listTenantNotifications,
  markTenantNotificationRead,
} from "../services/tenant-access.service";
import {
  getTenantDashboardSummary,
  listTenantPurchases,
} from "../services/tenant-dashboard.service";
import { getTenantExceptionalState } from "../services/tenant-exceptional-state.service";
import { getTenantHistorySummary } from "../services/tenant-history-summary.service";
import { listTenantPurchaseRollups } from "../services/tenant-purchase-rollups.service";
import { listTenantRecoveryStates } from "../services/tenant-recovery-state.service";
import {
  getTenantTokenDeliveryDetail,
  listTenantTokenDeliveries,
} from "../services/tenant-token-delivery.service";
import {
  tenantAccessBootstrapSchema,
  tenantDeviceTokenUpsertSchema,
  tenantHistorySummaryQuerySchema,
  tenantNotificationIdParamSchema,
  tenantNotificationListQuerySchema,
  tenantPurchaseListQuerySchema,
  tenantPurchaseRollupQuerySchema,
  tenantRecoveryStateQuerySchema,
  tenantTokenDeliveryAcknowledgeParamSchema,
  tenantTokenDeliveryIdParamSchema,
  tenantTokenDeliveryListQuerySchema,
} from "../validators/tenant-access";

export const tenantAccessRoutes = new Hono<TenantAppBindings>();

tenantAccessRoutes.post(
  "/bootstrap",
  zValidator("json", tenantAccessBootstrapSchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await bootstrapTenantAccess(body.meterNumber);
    if (result === null) {
      return c.json({ error: "Active sub-meter not found" }, 404);
    }

    return c.json({
      data: {
        accessToken: result.accessToken,
        tenantAccess: result.tenantAccess,
      },
      message: "Tenant access created",
    });
  },
);

tenantAccessRoutes.use("*", requireTenantAccess);

tenantAccessRoutes.get("/me", (c) =>
  c.json({
    data: c.get("tenantAccess"),
  }),
);

tenantAccessRoutes.get("/summary", async (c) => {
  const tenantAccess = c.get("tenantAccess");
  const data = await getTenantDashboardSummary(tenantAccess);

  return c.json({ data });
});

tenantAccessRoutes.get(
  "/history-summary",
  zValidator("query", tenantHistorySummaryQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const tenantAccess = c.get("tenantAccess");
    const data = await getTenantHistorySummary(tenantAccess, query);

    return c.json({ data });
  },
);

tenantAccessRoutes.get("/exceptional-state", async (c) => {
  const tenantAccess = c.get("tenantAccess");
  const data = await getTenantExceptionalState(tenantAccess);

  return c.json(data);
});

tenantAccessRoutes.get(
  "/recovery-states",
  zValidator("query", tenantRecoveryStateQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const tenantAccess = c.get("tenantAccess");
    const data = await listTenantRecoveryStates(tenantAccess, query);

    return c.json(toMobileCollectionResponse(data, query));
  },
);

tenantAccessRoutes.get(
  "/purchases",
  zValidator("query", tenantPurchaseListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const tenantAccess = c.get("tenantAccess");
    const data = await listTenantPurchases(tenantAccess, query);

    return c.json(toMobileCollectionResponse(data, query));
  },
);

tenantAccessRoutes.get(
  "/purchase-rollups",
  zValidator("query", tenantPurchaseRollupQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const tenantAccess = c.get("tenantAccess");
    const data = await listTenantPurchaseRollups(tenantAccess, query);

    return c.json(toMobileCollectionResponse(data, query));
  },
);

tenantAccessRoutes.get(
  "/token-deliveries",
  zValidator("query", tenantTokenDeliveryListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const tenantAccess = c.get("tenantAccess");
    const data = await listTenantTokenDeliveries(tenantAccess, query);

    return c.json(toMobileCollectionResponse(data, query));
  },
);

tenantAccessRoutes.get(
  "/token-deliveries/:transactionId",
  zValidator("param", tenantTokenDeliveryIdParamSchema),
  async (c) => {
    const { transactionId } = c.req.valid("param");
    const tenantAccess = c.get("tenantAccess");
    const data = await getTenantTokenDeliveryDetail(tenantAccess, transactionId);
    if (data === null) {
      return c.json({ error: "Token delivery not found" }, 404);
    }

    return c.json({ data });
  },
);

tenantAccessRoutes.post(
  "/token-deliveries/:transactionId/acknowledge",
  zValidator("param", tenantTokenDeliveryAcknowledgeParamSchema),
  async (c) => {
    const { transactionId } = c.req.valid("param");
    const tenantAccess = c.get("tenantAccess");
    const data = await acknowledgeTenantTokenDelivery(
      tenantAccess.id,
      transactionId,
    );
    if (data === null) {
      return c.json({ error: "Token delivery notification not found" }, 404);
    }

    return c.json({ data, message: "Token delivery acknowledged" });
  },
);

tenantAccessRoutes.get(
  "/notifications",
  zValidator("query", tenantNotificationListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const tenantAccess = c.get("tenantAccess");
    const data = await listTenantNotifications(tenantAccess.id, query);

    return c.json(toMobileCollectionResponse(data, query));
  },
);

tenantAccessRoutes.post(
  "/device-tokens",
  zValidator("json", tenantDeviceTokenUpsertSchema),
  async (c) => {
    const body = c.req.valid("json");
    const tenantAccess = c.get("tenantAccess");
    const data = await upsertTenantDeviceToken({
      platform: body.platform,
      tenantAccessId: tenantAccess.id,
      token: body.token,
    });

    return c.json({ data, message: "Tenant device token saved" });
  },
);

tenantAccessRoutes.post(
  "/notifications/:id/read",
  zValidator("param", tenantNotificationIdParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const tenantAccess = c.get("tenantAccess");
    const data = await markTenantNotificationRead(tenantAccess.id, id);
    if (data === null) {
      return c.json({ error: "Notification not found" }, 404);
    }

    return c.json({ data, message: "Notification marked as read" });
  },
);
