import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppBindings } from "../lib/auth-middleware";
import { requirePermission } from "../lib/auth-middleware";
import {
  enqueueCustomerAppNotificationDelivery,
  listCustomerAppNotifications,
} from "../services/app-notifications.service";
import {
  deactivateCustomerDeviceToken,
  listCustomerDeviceTokens,
  upsertCustomerDeviceToken,
} from "../services/customer-device-tokens.service";
import {
  appNotificationIdParamSchema,
  appNotificationListQuerySchema,
  customerDeviceTokenListQuerySchema,
  customerDeviceTokenUpsertSchema,
} from "../validators/app-notifications";

export const appNotificationRoutes = new Hono<AppBindings>();

appNotificationRoutes.use("*", requirePermission("app_notifications:manage"));

appNotificationRoutes.get(
  "/",
  zValidator("query", appNotificationListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const data = await listCustomerAppNotifications(query);
    return c.json({ count: data.length, data });
  },
);

appNotificationRoutes.post(
  "/:id/requeue",
  zValidator("param", appNotificationIdParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
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
    const query = c.req.valid("query");
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
  async (c) => {
    const { id } = c.req.valid("param");
    const data = await deactivateCustomerDeviceToken(id);
    if (data === null) {
      return c.json({ error: "Device token not found" }, 404);
    }

    return c.json({ data, message: "Device token deactivated" });
  },
);
