import { Hono, type Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  approveApplicationSchema,
  applicationQuerySchema,
  createApplicationSchema,
  rejectApplicationSchema,
} from "../validators/applications";
import {
  ApplicationError,
  approveMeterApplication,
  createMeterApplication,
  getMeterApplicationById,
  listMeterApplications,
  rejectMeterApplication,
} from "../services/application-onboarding.service";
import { requireAdmin, type AppBindings } from "../lib/auth-middleware";

const applicationIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const applicationRoutes = new Hono<AppBindings>();

applicationRoutes.post(
  "/",
  zValidator("json", createApplicationSchema),
  async (c) => {
    try {
      const body = c.req.valid("json");
      const application = await createMeterApplication(body);
      return c.json({ data: application }, 201);
    } catch (error) {
      return handleApplicationError(c, error);
    }
  }
);

applicationRoutes.get(
  "/",
  requireAdmin,
  zValidator("query", applicationQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await listMeterApplications(query);
    return c.json(result);
  }
);

applicationRoutes.get(
  "/:id",
  requireAdmin,
  zValidator("param", applicationIdParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const application = await getMeterApplicationById(id);
    if (!application) {
      return c.json({ error: "Application not found" }, 404);
    }
    return c.json({ data: application });
  }
);

applicationRoutes.post(
  "/:id/approve",
  requireAdmin,
  zValidator("param", applicationIdParamSchema),
  zValidator("json", approveApplicationSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    try {
      const approved = await approveMeterApplication(id, body);
      return c.json({
        message: "Application approved and meters registered",
        data: approved,
      });
    } catch (error) {
      return handleApplicationError(c, error);
    }
  }
);

applicationRoutes.post(
  "/:id/reject",
  requireAdmin,
  zValidator("param", applicationIdParamSchema),
  zValidator("json", rejectApplicationSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const { reason } = c.req.valid("json");

    try {
      await rejectMeterApplication(id);
      return c.json({
        message: "Application rejected",
        reason,
      });
    } catch (error) {
      return handleApplicationError(c, error);
    }
  }
);

function handleApplicationError(c: Context<AppBindings>, error: unknown) {
  if (error instanceof ApplicationError) {
    return c.json(
      { error: error.message },
      error.statusCode as 400 | 404 | 409
    );
  }

  console.error("[Applications]", error);
  return c.json({ error: "Internal Server Error" }, 500);
}
