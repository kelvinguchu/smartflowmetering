import { createMiddleware } from "hono/factory";
import { getLandlordAccessByUserId } from "../services/landlord/landlord-access.service";
import type { LandlordAccessSummary } from "../services/landlord/landlord-access.types";
import { auth } from "./auth";
import type { AppBindings } from "./auth-middleware";

export interface LandlordAppBindings extends AppBindings {
  Variables: AppBindings["Variables"] & {
    landlordAccess: LandlordAccessSummary;
  };
}

export const requireLandlordAccess = createMiddleware<LandlordAppBindings>(
  async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const authSession = session?.session ?? null;
    const authUser = session?.user ?? null;
    if (authSession === null || authUser === null) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (authUser.banned === true) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const landlordAccess = await getLandlordAccessByUserId(authUser.id);
    if (authUser.role !== "landlord" || landlordAccess === null) {
      return c.json({ error: "Forbidden" }, 403);
    }

    c.set("authSession", authSession);
    c.set("authUser", authUser);
    c.set("landlordAccess", landlordAccess);
    c.set("session", authSession);
    c.set("user", authUser);
    await next();
  },
);


