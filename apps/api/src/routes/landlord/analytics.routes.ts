import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { LandlordAppBindings } from "../../lib/landlord-access-middleware";
import { toMobileCollectionResponse } from "../../lib/mobile-collection-response";
import { getLandlordPropertyAnalyticsSummary } from "../../services/landlord/landlord-property-analytics-summary.service";
import { listLandlordPropertyMotherMeterComparisons } from "../../services/landlord/landlord-property-mother-meter-comparisons.service";
import { getLandlordPropertyRollups } from "../../services/landlord/landlord-property-rollups.service";
import {
  landlordPropertyAnalyticsSummaryQuerySchema,
  landlordPropertyComparisonQuerySchema,
  landlordPropertyIdParamSchema,
  landlordPropertyRollupQuerySchema,
} from "../../validators/landlord-access";

export const landlordAnalyticsRoutes = new Hono<LandlordAppBindings>();

landlordAnalyticsRoutes.get(
  "/:id/analytics-summary",
  zValidator("param", landlordPropertyIdParamSchema),
  zValidator("query", landlordPropertyAnalyticsSummaryQuerySchema),
  async (c) => {
    const landlordAccess = c.get("landlordAccess");
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const data = await getLandlordPropertyAnalyticsSummary(
      landlordAccess.customerId,
      id,
      query,
    );
    if (data === null) {
      return c.json({ error: "Property not found" }, 404);
    }

    return c.json({ data });
  },
);

landlordAnalyticsRoutes.get(
  "/:id/rollups",
  zValidator("param", landlordPropertyIdParamSchema),
  zValidator("query", landlordPropertyRollupQuerySchema),
  async (c) => {
    const landlordAccess = c.get("landlordAccess");
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const data = await getLandlordPropertyRollups(landlordAccess.customerId, id, query);
    if (data === null) {
      return c.json({ error: "Property not found" }, 404);
    }

    return c.json(toMobileCollectionResponse(data, query));
  },
);

landlordAnalyticsRoutes.get(
  "/:id/mother-meter-comparisons",
  zValidator("param", landlordPropertyIdParamSchema),
  zValidator("query", landlordPropertyComparisonQuerySchema),
  async (c) => {
    const landlordAccess = c.get("landlordAccess");
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const data = await listLandlordPropertyMotherMeterComparisons(
      landlordAccess.customerId,
      id,
      query,
    );
    if (data === null) {
      return c.json({ error: "Property not found" }, 404);
    }

    return c.json(toMobileCollectionResponse(data, query));
  },
);






