import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppBindings } from "../../lib/auth-middleware";
import { requirePermission } from "../../lib/auth-middleware";
import {
  banManagedUser,
  createManagedUser,
  getManagedUser,
  listManagedUserSessions,
  listManagedUsers,
  revokeManagedUserSession,
  revokeManagedUserSessions,
  setManagedUserPassword,
  setManagedUserRole,
  unbanManagedUser,
  updateManagedUser,
} from "../../services/admin/user-management.service";
import {
  banManagedUserSchema,
  createManagedUserSchema,
  listManagedUsersQuerySchema,
  managedUserIdParamSchema,
  managedUserSessionParamSchema,
  setManagedUserPasswordSchema,
  setManagedUserRoleSchema,
  updateManagedUserSchema,
} from "../../validators/users";

export const userManagementRoutes = new Hono<AppBindings>();

userManagementRoutes.use("*", requirePermission("users:manage"));

userManagementRoutes.get(
  "/",
  zValidator("query", listManagedUsersQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await listManagedUsers(c.req.raw.headers, query);

    return c.json({
      data: result.users,
      pagination: {
        limit: query.limit ?? 100,
        offset: query.offset ?? 0,
        total: result.total,
      },
    });
  },
);

userManagementRoutes.get(
  "/:userId",
  zValidator("param", managedUserIdParamSchema),
  async (c) => {
    const { userId } = c.req.valid("param");
    const managedUser = await getManagedUser(c.req.raw.headers, userId);
    return c.json({ data: managedUser });
  },
);

userManagementRoutes.post(
  "/",
  zValidator("json", createManagedUserSchema),
  async (c) => {
    const actorUser = c.get("user");
    const body = c.req.valid("json");
    const result = await createManagedUser(
      { actorUser, headers: c.req.raw.headers },
      body,
    );

    return c.json({ data: result.user }, 201);
  },
);

userManagementRoutes.patch(
  "/:userId",
  zValidator("param", managedUserIdParamSchema),
  zValidator("json", updateManagedUserSchema),
  async (c) => {
    const actorUser = c.get("user");
    const { userId } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await updateManagedUser(
      { actorUser, headers: c.req.raw.headers },
      userId,
      body,
    );

    return c.json({ data: result });
  },
);

userManagementRoutes.post(
  "/:userId/role",
  zValidator("param", managedUserIdParamSchema),
  zValidator("json", setManagedUserRoleSchema),
  async (c) => {
    const actorUser = c.get("user");
    const { userId } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await setManagedUserRole(
      { actorUser, headers: c.req.raw.headers },
      userId,
      body,
    );

    return c.json({ data: result.user });
  },
);

userManagementRoutes.post(
  "/:userId/ban",
  zValidator("param", managedUserIdParamSchema),
  zValidator("json", banManagedUserSchema),
  async (c) => {
    const actorUser = c.get("user");
    const { userId } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await banManagedUser(
      { actorUser, headers: c.req.raw.headers },
      userId,
      body,
    );

    return c.json({
      data: result.user,
      sessionsRevoked: result.sessionsRevoked,
    });
  },
);

userManagementRoutes.post(
  "/:userId/unban",
  zValidator("param", managedUserIdParamSchema),
  async (c) => {
    const actorUser = c.get("user");
    const { userId } = c.req.valid("param");
    const result = await unbanManagedUser(
      { actorUser, headers: c.req.raw.headers },
      userId,
    );

    return c.json({ data: result.user });
  },
);

userManagementRoutes.post(
  "/:userId/password",
  zValidator("param", managedUserIdParamSchema),
  zValidator("json", setManagedUserPasswordSchema),
  async (c) => {
    const actorUser = c.get("user");
    const { userId } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await setManagedUserPassword(
      { actorUser, headers: c.req.raw.headers },
      userId,
      body,
    );

    return c.json(result);
  },
);

userManagementRoutes.get(
  "/:userId/sessions",
  zValidator("param", managedUserIdParamSchema),
  async (c) => {
    const { userId } = c.req.valid("param");
    const result = await listManagedUserSessions(c.req.raw.headers, userId);
    return c.json({ data: result, count: result.length });
  },
);

userManagementRoutes.post(
  "/:userId/sessions/revoke-all",
  zValidator("param", managedUserIdParamSchema),
  async (c) => {
    const actorUser = c.get("user");
    const { userId } = c.req.valid("param");
    const result = await revokeManagedUserSessions(
      { actorUser, headers: c.req.raw.headers },
      userId,
    );

    return c.json(result);
  },
);

userManagementRoutes.post(
  "/:userId/sessions/:sessionId/revoke",
  zValidator("param", managedUserSessionParamSchema),
  async (c) => {
    const actorUser = c.get("user");
    const { userId, sessionId } = c.req.valid("param");
    const result = await revokeManagedUserSession(
      { actorUser, headers: c.req.raw.headers },
      userId,
      sessionId,
    );

    return c.json(result);
  },
);




