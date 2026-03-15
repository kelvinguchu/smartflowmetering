import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppBindings } from "../lib/auth-middleware";
import { requirePermission } from "../lib/auth-middleware";
import {
  listAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from "../services/admin-notifications.service";
import {
  queueDailyLandlordUsageSummarySms,
  queueLowBalanceNotifications,
  queuePostpaidReminderNotifications,
} from "../services/mother-meter-alerts.service";
import { runSmsProviderAlerts } from "../services/sms-provider-alerts.service";
import {
  notificationIdParamSchema,
  notificationListQuerySchema,
  runAlertsBodySchema,
  runDailyUsageBodySchema,
  runSmsProviderAlertsBodySchema,
} from "../validators/notifications";

export const notificationRoutes = new Hono<AppBindings>();

notificationRoutes.use("*", requirePermission("notifications:manage"));

notificationRoutes.get(
  "/",
  zValidator("query", notificationListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await listAdminNotifications(query);
    return c.json(result);
  }
);

notificationRoutes.patch(
  "/:id/read",
  zValidator("param", notificationIdParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const updated = await markAdminNotificationRead(id);

    if (updated === null) {
      return c.json({ error: "Notification not found" }, 404);
    }

    return c.json({ data: updated });
  }
);

notificationRoutes.post("/read-all", async (c) => {
  const result = await markAllAdminNotificationsRead();
  return c.json(result);
});

notificationRoutes.post(
  "/run-alert-checks",
  zValidator("json", runAlertsBodySchema),
  async (c) => {
    const body = c.req.valid("json");
    const [lowBalance, postpaid] = await Promise.all([
      queueLowBalanceNotifications({
        maxAlerts: body.maxAlerts,
      }),
      queuePostpaidReminderNotifications({
        maxAlerts: body.maxAlerts,
        daysAfterLastPayment: body.daysAfterLastPayment,
      }),
    ]);

    return c.json({
      message: "Alert checks completed",
      lowBalance,
      postpaid,
    });
  }
);

notificationRoutes.post(
  "/run-sms-provider-alerts",
  zValidator("json", runSmsProviderAlertsBodySchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await runSmsProviderAlerts(body);

    return c.json({
      message: "SMS provider alert checks completed",
      ...result,
    });
  },
);

notificationRoutes.post(
  "/run-daily-usage-sms",
  zValidator("json", runDailyUsageBodySchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await queueDailyLandlordUsageSummarySms({
      targetDate: body.date,
      maxLandlords: body.maxLandlords,
      timezone: body.timezone,
    });

    return c.json({
      message: "Daily purchase SMS queue run completed",
      ...result,
    });
  }
);
