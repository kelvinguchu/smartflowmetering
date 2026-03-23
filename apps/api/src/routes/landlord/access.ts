import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { LandlordAppBindings } from "../../lib/landlord-access-middleware";
import { requireLandlordAccess } from "../../lib/landlord-access-middleware";
import { toMobileCollectionResponse } from "../../lib/mobile-collection-response";
import {
  listLandlordNotifications,
  markLandlordNotificationRead,
} from "../../services/landlord/landlord-access.service";
import { listLandlordActivity } from "../../services/landlord/landlord-activity.service";
import {
  getLandlordDashboardSummary,
  listLandlordMotherMeters,
  listLandlordPurchases,
} from "../../services/landlord/landlord-dashboard.service";
import {
  getLandlordMotherMeterDetail,
  listLandlordUsageHistory,
} from "../../services/landlord/landlord-history.service";
import {
  getLandlordMotherMeterDailyRollups,
} from "../../services/landlord/landlord-mother-meter-daily-rollups.service";
import { getLandlordMotherMeterTimeline } from "../../services/landlord/landlord-mother-meter-timeline.service";
import { getLandlordSubMeterDailyRollups } from "../../services/landlord/landlord-sub-meter-daily-rollups.service";
import { getLandlordSubMeterTimeline } from "../../services/landlord/landlord-sub-meter-timeline.service";
import { getLandlordSubMeterDetail } from "../../services/landlord/landlord-sub-meter.service";
import { listLandlordTimeline } from "../../services/landlord/landlord-timeline.service";
import {
  landlordActivityQuerySchema,
  landlordDailyRollupQuerySchema,
  landlordMotherMeterIdParamSchema,
  landlordMotherMeterListQuerySchema,
  landlordNotificationIdParamSchema,
  landlordNotificationListQuerySchema,
  landlordPurchaseListQuerySchema,
  landlordSubMeterDetailQuerySchema,
  landlordSubMeterIdParamSchema,
  landlordSummaryQuerySchema,
  landlordTimelineQuerySchema,
  landlordTimelineWindowQuerySchema,
  landlordUsageHistoryQuerySchema,
} from "../../validators/landlord-access";
import { landlordAccessProfileRoutes } from "./profile.routes";
import { landlordAnalyticsRoutes } from "./analytics.routes";
import { landlordExceptionalStateRoutes } from "./exceptional-state.routes";
import { landlordThresholdRoutes } from "./thresholds.routes";

export const landlordAccessRoutes = new Hono<LandlordAppBindings>();

landlordAccessRoutes.route("/", landlordAccessProfileRoutes);
landlordAccessRoutes.use("*", requireLandlordAccess);
landlordAccessRoutes.route("/properties", landlordAnalyticsRoutes);
landlordAccessRoutes.route("/exceptional-state", landlordExceptionalStateRoutes);
landlordAccessRoutes.route("/thresholds", landlordThresholdRoutes);

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

















