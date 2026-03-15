import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { LandlordAppBindings } from "../lib/landlord-access-middleware";
import { listLandlordMotherMeterThresholdHistory } from "../services/landlord-threshold-history.service";
import {
  getLandlordThresholdSummary,
  listLandlordMotherMeterThresholdStates,
} from "../services/landlord-thresholds.service";
import {
  landlordMotherMeterIdParamSchema,
  landlordThresholdHistoryQuerySchema,
  landlordThresholdListQuerySchema,
  landlordThresholdSummaryQuerySchema,
} from "../validators/landlord-access";

export const landlordThresholdRoutes = new Hono<LandlordAppBindings>();

landlordThresholdRoutes.get(
  "/summary",
  zValidator("query", landlordThresholdSummaryQuerySchema),
  async (c) => {
    const landlordAccess = c.get("landlordAccess");
    const query = c.req.valid("query");
    const data = await getLandlordThresholdSummary(landlordAccess.customerId, query);
    return c.json({ data });
  },
);

landlordThresholdRoutes.get(
  "/mother-meters",
  zValidator("query", landlordThresholdListQuerySchema),
  async (c) => {
    const landlordAccess = c.get("landlordAccess");
    const query = c.req.valid("query");
    const data = await listLandlordMotherMeterThresholdStates(
      landlordAccess.customerId,
      query,
    );
    return c.json({ count: data.length, data });
  },
);

landlordThresholdRoutes.get(
  "/mother-meters/:id/history",
  zValidator("param", landlordMotherMeterIdParamSchema),
  zValidator("query", landlordThresholdHistoryQuerySchema),
  async (c) => {
    const landlordAccess = c.get("landlordAccess");
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const data = await listLandlordMotherMeterThresholdHistory(
      landlordAccess.customerId,
      id,
      query,
    );
    if (data === null) {
      return c.json({ error: "Mother meter not found" }, 404);
    }

    return c.json({ count: data.length, data });
  },
);
