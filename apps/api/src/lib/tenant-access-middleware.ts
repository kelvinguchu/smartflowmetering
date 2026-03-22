import { createMiddleware } from "hono/factory";
import { getTenantAccessByToken, touchTenantAccess } from "../services/tenant/tenant-access.service";
import type { TenantAccessSummary } from "../services/tenant/tenant-access.types";
import type { AppBindings } from "./auth-middleware";

export interface TenantAppBindings extends AppBindings {
  Variables: AppBindings["Variables"] & {
    tenantAccess: TenantAccessSummary;
  };
}

export const requireTenantAccess = createMiddleware<TenantAppBindings>(
  async (c, next) => {
    const token = getBearerToken(c.req.header("authorization"));
    if (token === null) {
      return c.json(
        {
          error: "Unauthorized",
          message: "Unauthorized: Tenant access token required",
        },
        401,
      );
    }

    const tenantAccess = await getTenantAccessByToken(token);
    if (tenantAccess === null) {
      return c.json(
        {
          error: "Unauthorized",
          message: "Unauthorized: Invalid tenant access token",
        },
        401,
      );
    }

    await touchTenantAccess(tenantAccess.id);
    c.set("tenantAccess", tenantAccess);
    await next();
  },
);

function getBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");
  if (scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim() || null;
}


