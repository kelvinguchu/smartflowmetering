import { createMiddleware } from "hono/factory";
import { auth } from "./auth";

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;

export type AuthSession = NonNullable<SessionResult>["session"];
export type AuthUser = NonNullable<SessionResult>["user"];

export type AppBindings = {
  Variables: {
    authSession: AuthSession | null;
    authUser: AuthUser | null;
    session: AuthSession;
    user: AuthUser;
  };
};

async function getSessionFromHeaders(headers: Headers): Promise<SessionResult> {
  return auth.api.getSession({ headers });
}

export const loadAuthContext = createMiddleware<AppBindings>(async (c, next) => {
  const session = await getSessionFromHeaders(c.req.raw.headers);
  c.set("authSession", session?.session ?? null);
  c.set("authUser", session?.user ?? null);
  await next();
});

export const requireAuth = createMiddleware<AppBindings>(async (c, next) => {
  const session = await getSessionFromHeaders(c.req.raw.headers);
  const authSession = session?.session ?? null;
  const authUser = session?.user ?? null;

  if (!authSession || !authUser) {
    return c.json(
      {
        error: "Unauthorized",
        message: "Unauthorized: Please sign in to access this resource",
      },
      401
    );
  }

  if (authUser.banned) {
    return c.json(
      {
        error: "Forbidden",
        message: "Forbidden: Your account has been suspended",
      },
      403
    );
  }

  c.set("authSession", authSession);
  c.set("authUser", authUser);
  c.set("session", authSession);
  c.set("user", authUser);
  await next();
});

export const requireAdmin = createMiddleware<AppBindings>(async (c, next) => {
  const session = await getSessionFromHeaders(c.req.raw.headers);
  const authSession = session?.session ?? null;
  const authUser = session?.user ?? null;

  if (!authSession || !authUser) {
    return c.json(
      {
        error: "Unauthorized",
        message: "Unauthorized: Please sign in to access this resource",
      },
      401
    );
  }

  if (authUser.banned) {
    return c.json(
      {
        error: "Forbidden",
        message: "Forbidden: Your account has been suspended",
      },
      403
    );
  }

  if (authUser.role !== "admin") {
    return c.json(
      {
        error: "Forbidden",
        message: "Forbidden: Admin access required",
      },
      403
    );
  }

  c.set("authSession", authSession);
  c.set("authUser", authUser);
  c.set("session", authSession);
  c.set("user", authUser);
  await next();
});
