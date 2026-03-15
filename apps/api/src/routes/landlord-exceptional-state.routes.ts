import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { LandlordAppBindings } from "../lib/landlord-access-middleware";
import {
  getLandlordExceptionalStateDefaults,
  getLandlordExceptionalStateSummary,
  listLandlordExceptionalMotherMeterStates,
} from "../services/landlord-exceptional-state.service";
import {
  landlordExceptionalStateListQuerySchema,
  landlordExceptionalStateSummaryQuerySchema,
} from "../validators/landlord-access";

export const landlordExceptionalStateRoutes = new Hono<LandlordAppBindings>();

landlordExceptionalStateRoutes.get(
  "/summary",
  zValidator("query", landlordExceptionalStateSummaryQuerySchema),
  async (c) => {
    const landlordAccess = c.get("landlordAccess");
    const query = c.req.valid("query");
    const data = await getLandlordExceptionalStateSummary(
      landlordAccess.customerId,
      query,
    );

    return c.json({
      data,
      defaults: getLandlordExceptionalStateDefaults(),
    });
  },
);

landlordExceptionalStateRoutes.get(
  "/mother-meters",
  zValidator("query", landlordExceptionalStateListQuerySchema),
  async (c) => {
    const landlordAccess = c.get("landlordAccess");
    const query = c.req.valid("query");
    const data = await listLandlordExceptionalMotherMeterStates(
      landlordAccess.customerId,
      query,
    );

    return c.json({
      count: data.length,
      data,
      defaults: getLandlordExceptionalStateDefaults(),
    });
  },
);
