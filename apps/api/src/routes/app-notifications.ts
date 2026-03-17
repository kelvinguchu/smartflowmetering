import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppBindings } from "../lib/auth-middleware";
import { requirePermission } from "../lib/auth-middleware";
import {
  ensureSupportScopedCustomerLookup,
  isAdminStaffUser,
} from "../lib/staff-route-access";
import {
  enqueueCustomerAppNotificationDelivery,
  listCustomerAppNotifications,
} from "../services/app-notifications.service";
import { getCustomerAppNotificationById } from "../services/app-notification-state.service";
import {
  deactivateCustomerDeviceToken,
  getCustomerDeviceTokenById,
  listCustomerDeviceTokens,
  upsertCustomerDeviceToken,
} from "../services/customer-device-tokens.service";
import {
  appNotificationIdParamSchema,
  appNotificationListQuerySchema,
  customerLookupScopeQuerySchema,
  customerDeviceTokenListQuerySchema,
  customerDeviceTokenUpsertSchema,
} from "../validators/app-notifications";

export const appNotificationRoutes = new Hono<AppBindings>();

appNotificationRoutes.use("*", requirePermission("app_notifications:manage"));

appNotificationRoutes.get(
  "/",
  zValidator("query", appNotificationListQuerySchema),
  async (c) => {
    const actor = c.get("user");
    const query = c.req.valid("query");
    ensureSupportScopedCustomerLookup(
      actor,
      query,
      "customer app notifications",
    );
    const data = await listCustomerAppNotifications(query);
    return c.json({ count: data.length, data });
  },
);

appNotificationRoutes.post(
  "/:id/requeue",
  zValidator("param", appNotificationIdParamSchema),
  zValidator("query", customerLookupScopeQuerySchema),
  async (c) => {
    const actor = c.get("user");
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    ensureSupportScopedCustomerLookup(
      actor,
      query,
      "customer app notification requeueing",
    );
    const notification = await getCustomerAppNotificationById(id);
    if (!notification) {
      return c.json({ error: "Customer app notification not found" }, 404);
    }
    if (
      !isAdminStaffUser(actor) &&
      !matchesNotificationScope(notification, query)
    ) {
      return c.json({ error: "Forbidden" }, 403);
    }

    try {
      const result = await enqueueCustomerAppNotificationDelivery(id);
      return c.json({ data: result, message: "App notification queued" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to queue app notification";
      const status = message.includes("cannot be requeued") ? 409 : 404;
      return c.json({ error: message }, status);
    }
  },
);

appNotificationRoutes.get(
  "/device-tokens",
  zValidator("query", customerDeviceTokenListQuerySchema),
  async (c) => {
    const actor = c.get("user");
    const query = c.req.valid("query");
    ensureSupportScopedCustomerLookup(
      actor,
      query,
      "customer device tokens",
    );
    const data = await listCustomerDeviceTokens({
      landlordId: query.landlordId,
      phoneNumber: query.phoneNumber,
    });
    return c.json({ count: data.length, data });
  },
);

appNotificationRoutes.post(
  "/device-tokens",
  zValidator("json", customerDeviceTokenUpsertSchema),
  async (c) => {
    const body = c.req.valid("json");
    const data = await upsertCustomerDeviceToken(body);
    return c.json({ data, message: "Device token saved" });
  },
);

appNotificationRoutes.delete(
  "/device-tokens/:id",
  zValidator("param", appNotificationIdParamSchema),
  zValidator("query", customerLookupScopeQuerySchema),
  async (c) => {
    const actor = c.get("user");
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    ensureSupportScopedCustomerLookup(
      actor,
      query,
      "customer device token deactivation",
    );
    const token = await getCustomerDeviceTokenById(id);
    if (!token) {
      return c.json({ error: "Device token not found" }, 404);
    }
    if (!isAdminStaffUser(actor) && !matchesDeviceTokenScope(token, query)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const data = await deactivateCustomerDeviceToken(id);
    if (data === null) {
      return c.json({ error: "Device token not found" }, 404);
    }

    return c.json({ data, message: "Device token deactivated" });
  },
);

function matchesNotificationScope(
  notification: {
    landlordId: string | null;
    meterNumber: string | null;
    phoneNumber: string | null;
  },
  query: {
    landlordId?: string;
    meterNumber?: string;
    phoneNumber?: string;
  },
): boolean {
  return Boolean(
    (query.landlordId && notification.landlordId === query.landlordId) ||
      (query.meterNumber && notification.meterNumber === query.meterNumber) ||
      (query.phoneNumber && notification.phoneNumber === query.phoneNumber),
  );
}

function matchesDeviceTokenScope(
  token: {
    landlordId: string | null;
    phoneNumber: string | null;
  },
  query: {
    landlordId?: string;
    meterNumber?: string;
    phoneNumber?: string;
  },
): boolean {
  return Boolean(
    (query.landlordId && token.landlordId === query.landlordId) ||
      (query.phoneNumber && token.phoneNumber === query.phoneNumber),
  );
}
