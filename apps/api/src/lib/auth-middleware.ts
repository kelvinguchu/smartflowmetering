import { Elysia } from "elysia";
import { auth } from "./auth";

/**
 * Auth Middleware Plugin for Elysia
 *
 * Provides authentication and authorization via derive/macro pattern:
 * - All routes derive `authSession` and `authUser` from the request
 * - Routes can add `{ auth: true }` or `{ adminOnly: true }` options
 *
 * Usage:
 * ```ts
 * app.use(authMiddleware)
 *    .get("/protected", ({ user }) => user, { auth: true })
 *    .post("/admin", ({ user }) => user, { adminOnly: true })
 * ```
 */
export const authMiddleware = new Elysia({ name: "auth-middleware" })
  // Derive session and user for all requests
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    return {
      authSession: session?.session ?? null,
      authUser: session?.user ?? null,
    };
  })
  // Define macros for route-level auth requirements
  .macro({
    // Require any authenticated user
    auth: {
      async resolve({ authSession, authUser }) {
        if (!authSession || !authUser) {
          throw new Error("Unauthorized: Please sign in to access this resource");
        }

        // Check if user is banned
        if (authUser.banned) {
          throw new Error("Forbidden: Your account has been suspended");
        }

        return { session: authSession, user: authUser };
      },
    },

    // Require admin role
    adminOnly: {
      async resolve({ authSession, authUser }) {
        if (!authSession || !authUser) {
          throw new Error("Unauthorized: Please sign in to access this resource");
        }

        // Check if user is banned
        if (authUser.banned) {
          throw new Error("Forbidden: Your account has been suspended");
        }

        // Check admin role
        if (authUser.role !== "admin") {
          throw new Error("Forbidden: Admin access required");
        }

        return { session: authSession, user: authUser };
      },
    },
  });

// Get the session result type
type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;

// Export session and user types for routes
export type AuthSession = NonNullable<SessionResult>["session"];
export type AuthUser = NonNullable<SessionResult>["user"];
