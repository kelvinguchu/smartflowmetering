import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { LandlordAppBindings } from "../lib/landlord-access-middleware";
import { requireLandlordAccess } from "../lib/landlord-access-middleware";
import { toMobileCollectionResponse } from "../lib/mobile-collection-response";
import { authRateLimit } from "../lib/rate-limit";
import { upsertCustomerDeviceToken } from "../services/customer-device-tokens.service";
import {
  listLandlordNotifications,
  markLandlordNotificationRead,
} from "../services/landlord-access.service";
import { listLandlordActivity } from "../services/landlord-activity.service";
import {
  getLandlordDashboardSummary,
  listLandlordMotherMeters,
  listLandlordPurchases,
} from "../services/landlord-dashboard.service";
import {
  getLandlordMotherMeterDetail,
  listLandlordUsageHistory,
} from "../services/landlord-history.service";
import {
  sendLandlordAccessOtp,
  verifyLandlordAccessOtp,
} from "../services/landlord-mobile-auth.service";
import { getLandlordMotherMeterDailyRollups } from "../services/landlord-mother-meter-daily-rollups.service";
import { getLandlordMotherMeterTimeline } from "../services/landlord-mother-meter-timeline.service";
import { getLandlordSubMeterDailyRollups } from "../services/landlord-sub-meter-daily-rollups.service";
import { getLandlordSubMeterTimeline } from "../services/landlord-sub-meter-timeline.service";
import { getLandlordSubMeterDetail } from "../services/landlord-sub-meter.service";
import { listLandlordTimeline } from "../services/landlord-timeline.service";
import {
  landlordActivityQuerySchema,
  landlordDailyRollupQuerySchema,
  landlordDeviceTokenUpsertSchema,
  landlordMotherMeterIdParamSchema,
  landlordMotherMeterListQuerySchema,
  landlordNotificationIdParamSchema,
  landlordNotificationListQuerySchema,
  landlordPurchaseListQuerySchema,
  landlordSendOtpSchema,
  landlordSubMeterDetailQuerySchema,
  landlordSubMeterIdParamSchema,
  landlordSummaryQuerySchema,
  landlordTimelineQuerySchema,
  landlordTimelineWindowQuerySchema,
  landlordUsageHistoryQuerySchema,
  landlordVerifyOtpSchema,
} from "../validators/landlord-access";
import { landlordAnalyticsRoutes } from "./landlord-analytics.routes";
import { landlordExceptionalStateRoutes } from "./landlord-exceptional-state.routes";
import { landlordThresholdRoutes } from "./landlord-thresholds.routes";

export const landlordAccessRoutes = new Hono<LandlordAppBindings>();

landlordAccessRoutes.post(
  "/send-otp",
  authRateLimit,
  zValidator("json", landlordSendOtpSchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await sendLandlordAccessOtp(c.req.raw.headers, body.phoneNumber);
    return c.json({
      data: { phoneNumber: result.normalizedPhoneNumber },
      message: "OTP sent",
    });
  },
);

landlordAccessRoutes.post(
  "/verify-otp",
  authRateLimit,
  zValidator("json", landlordVerifyOtpSchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await verifyLandlordAccessOtp(c.req.raw.headers, body);
    return c.json({
      data: {
        landlordAccess: result.landlordAccess,
        token: result.token,
        user: result.user,
      },
    });
  },
);

landlordAccessRoutes.use("*", requireLandlordAccess);
landlordAccessRoutes.route("/properties", landlordAnalyticsRoutes);
landlordAccessRoutes.route("/exceptional-state", landlordExceptionalStateRoutes);
landlordAccessRoutes.route("/thresholds", landlordThresholdRoutes);

landlordAccessRoutes.get("/me", (c) =>
  c.json({
    data: {
      landlordAccess: c.get("landlordAccess"),
      user: c.get("user"),
    },
  }),
);

landlordAccessRoutes.get("/summary", zValidator("query", landlordSummaryQuerySchema), async (c) => {
  const landlordAccess = c.get("landlordAccess");
  const query = c.req.valid("query");
  const data = await getLandlordDashboardSummary(
    landlordAccess.customerId,
    query.propertyId,
  );
  return c.json({ data });
});

landlordAccessRoutes.get(
  "/mother-meters",
  zValidator("query", landlordMotherMeterListQuerySchema),
  async (c) => {
  const landlordAccess = c.get("landlordAccess");
    const query = c.req.valid("query");
  const data = await listLandlordMotherMeters(
    landlordAccess.customerId,
    query.propertyId,
  );
  return c.json(toMobileCollectionResponse(data));
  },
);

landlordAccessRoutes.get(
  "/mother-meters/:id",
  zValidator("param", landlordMotherMeterIdParamSchema),
  async (c) => {
    const landlordAccess = c.get("landlordAccess");
    const { id } = c.req.valid("param");
    const data = await getLandlordMotherMeterDetail(landlordAccess.customerId, id);
    if (data === null) {
      return c.json({ error: "Mother meter not found" }, 404);
    }

    return c.json({ data });
  },
);

landlordAccessRoutes.get(
  "/mother-meters/:id/timeline",
  zValidator("param", landlordMotherMeterIdParamSchema),
  zValidator("query", landlordTimelineWindowQuerySchema),
  async (c) => {
    const landlordAccess = c.get("landlordAccess");
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const data = await getLandlordMotherMeterTimeline(landlordAccess.customerId, id, query);
    if (data === null) {
      return c.json({ error: "Mother meter not found" }, 404);
    }

    return c.json(toMobileCollectionResponse(data, query));
  },
);

landlordAccessRoutes.get(
  "/mother-meters/:id/daily-rollups",
  zValidator("param", landlordMotherMeterIdParamSchema),
  zValidator("query", landlordDailyRollupQuerySchema),
  async (c) => {
    const landlordAccess = c.get("landlordAccess");
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const data = await getLandlordMotherMeterDailyRollups(
      landlordAccess.customerId,
      id,
      query,
    );
    if (data === null) {
      return c.json({ error: "Mother meter not found" }, 404);
    }

    return c.json(toMobileCollectionResponse(data, query));
  },
);

landlordAccessRoutes.get(
  "/sub-meters/:id",
  zValidator("param", landlordSubMeterIdParamSchema),
  zValidator("query", landlordSubMeterDetailQuerySchema),
  async (c) => {
    const landlordAccess = c.get("landlordAccess");
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const data = await getLandlordSubMeterDetail(
      landlordAccess.customerId,
      id,
      query.purchaseLimit,
    );
    if (data === null) {
      return c.json({ error: "Sub meter not found" }, 404);
    }

    return c.json({ data });
  },
);

landlordAccessRoutes.get(
  "/sub-meters/:id/timeline",
  zValidator("param", landlordSubMeterIdParamSchema),
  zValidator("query", landlordTimelineWindowQuerySchema),
  async (c) => {
    const landlordAccess = c.get("landlordAccess");
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const data = await getLandlordSubMeterTimeline(landlordAccess.customerId, id, query);
    if (data === null) {
      return c.json({ error: "Sub meter not found" }, 404);
    }

    return c.json(toMobileCollectionResponse(data, query));
  },
);

landlordAccessRoutes.get(
  "/sub-meters/:id/daily-rollups",
  zValidator("param", landlordSubMeterIdParamSchema),
  zValidator("query", landlordDailyRollupQuerySchema),
  async (c) => {
    const landlordAccess = c.get("landlordAccess");
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const data = await getLandlordSubMeterDailyRollups(
      landlordAccess.customerId,
      id,
      query,
    );
    if (data === null) {
      return c.json({ error: "Sub meter not found" }, 404);
    }

    return c.json(toMobileCollectionResponse(data, query));
  },
);

landlordAccessRoutes.get(
  "/purchases",
  zValidator("query", landlordPurchaseListQuerySchema),
  async (c) => {
    const landlordAccess = c.get("landlordAccess");
    const query = c.req.valid("query");
    const data = await listLandlordPurchases(landlordAccess.customerId, query);
    return c.json(toMobileCollectionResponse(data, query));
  },
);

landlordAccessRoutes.get(
  "/activity",
  zValidator("query", landlordActivityQuerySchema),
  async (c) => {
    const landlordAccess = c.get("landlordAccess");
    const query = c.req.valid("query");
    const data = await listLandlordActivity(landlordAccess.customerId, query);
    return c.json(toMobileCollectionResponse(data, query));
  },
);

landlordAccessRoutes.get(
  "/usage-history",
  zValidator("query", landlordUsageHistoryQuerySchema),
  async (c) => {
    const landlordAccess = c.get("landlordAccess");
    const query = c.req.valid("query");
    const data = await listLandlordUsageHistory(landlordAccess.customerId, query);
    return c.json(toMobileCollectionResponse(data, query));
  },
);

landlordAccessRoutes.get(
  "/timeline",
  zValidator("query", landlordTimelineQuerySchema),
  async (c) => {
    const landlordAccess = c.get("landlordAccess");
    const query = c.req.valid("query");
    const data = await listLandlordTimeline(landlordAccess.customerId, query);
    return c.json(toMobileCollectionResponse(data, query));
  },
);

landlordAccessRoutes.get(
  "/notifications",
  zValidator("query", landlordNotificationListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const landlordAccess = c.get("landlordAccess");
    const data = await listLandlordNotifications(landlordAccess.customerId, query);
    return c.json(toMobileCollectionResponse(data, query));
  },
);

landlordAccessRoutes.post(
  "/device-tokens",
  zValidator("json", landlordDeviceTokenUpsertSchema),
  async (c) => {
    const body = c.req.valid("json");
    const landlordAccess = c.get("landlordAccess");
    const data = await upsertCustomerDeviceToken({
      landlordId: landlordAccess.customerId,
      platform: body.platform,
      token: body.token,
    });
    return c.json({ data, message: "Landlord device token saved" });
  },
);

landlordAccessRoutes.post(
  "/notifications/:id/read",
  zValidator("param", landlordNotificationIdParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const landlordAccess = c.get("landlordAccess");
    const data = await markLandlordNotificationRead(landlordAccess.customerId, id);
    if (data === null) {
      return c.json({ error: "Notification not found" }, 404);
    }

    return c.json({ data, message: "Notification marked as read" });
  },
);
