import { createMiddleware } from "hono/factory";
import { auth } from "./auth";
import { hasPermission, isStaffRole } from "./rbac";
import type { StaffPermission } from "./rbac";

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;

export type AuthSession = NonNullable<SessionResult>["session"];
export type AuthUser = NonNullable<SessionResult>["user"];

export interface AppBindings {
  Variables: {
    authSession: AuthSession | null;
    authUser: AuthUser | null;
    session: AuthSession;
    user: AuthUser;
  };
}

async function getSessionFromHeaders(headers: Headers): Promise<SessionResult> {
  return auth.api.getSession({ headers });
}

function getSessionParts(session: SessionResult) {
  return {
    authSession: session?.session ?? null,
    authUser: session?.user ?? null,
  };
}

async function requireSession(
  headers: Headers,
  options: {
    requireAdmin?: boolean;
    requireStaff?: boolean;
    permission?: StaffPermission;
  } = {},
) {
  const session = await getSessionFromHeaders(headers);
  const { authSession, authUser } = getSessionParts(session);
  if (!authSession || !authUser) {
    return {
      ok: false as const,
      status: 401 as const,
      body: {
        error: "Unauthorized",
        message: "Unauthorized: Please sign in to access this resource",
      },
    };
  }

  if (authUser.banned) {
    return {
      ok: false as const,
      status: 403 as const,
      body: {
        error: "Forbidden",
        message: "Forbidden: Your account has been suspended",
      },
    };
  }

  if (options.requireStaff && !isStaffRole(authUser.role)) {
    return {
      ok: false as const,
      status: 403 as const,
      body: {
        error: "Forbidden",
        message: "Forbidden: Staff access required",
      },
    };
  }

  if (options.requireAdmin && authUser.role !== "admin") {
    return {
      ok: false as const,
      status: 403 as const,
      body: {
        error: "Forbidden",
        message: "Forbidden: Admin access required",
      },
    };
  }

  if (options.permission && !hasPermission(authUser.role, options.permission)) {
    return {
      ok: false as const,
      status: 403 as const,
      body: {
        error: "Forbidden",
        message: "Forbidden: Insufficient permissions for this action",
      },
    };
  }

  return {
    ok: true as const,
    authSession,
    authUser,
  };
}

export const requireStaff = createMiddleware<AppBindings>(async (c, next) => {
  const result = await requireSession(c.req.raw.headers, { requireStaff: true });
  if (!result.ok) {
    return c.json(result.body, result.status);
  }

  c.set("authSession", result.authSession);
  c.set("authUser", result.authUser);
  c.set("session", result.authSession);
  c.set("user", result.authUser);
  await next();
});

export const requireAuth = requireStaff;

export const requireAdmin = createMiddleware<AppBindings>(async (c, next) => {
  const result = await requireSession(c.req.raw.headers, {
    requireStaff: true,
    requireAdmin: true,
  });
  if (!result.ok) {
    return c.json(result.body, result.status);
  }

  c.set("authSession", result.authSession);
  c.set("authUser", result.authUser);
  c.set("session", result.authSession);
  c.set("user", result.authUser);
  await next();
});

export function requirePermission(permission: StaffPermission) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const result = await requireSession(c.req.raw.headers, {
      requireStaff: true,
      permission,
    });
    if (!result.ok) {
      return c.json(result.body, result.status);
    }

    c.set("authSession", result.authSession);
    c.set("authUser", result.authUser);
    c.set("session", result.authSession);
    c.set("user", result.authUser);
    await next();
  });
}
