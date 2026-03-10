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
import { extractClientIp, writeAuditLog } from "../services/audit-log.service";
import { smsDeliveryQueue } from "../queues";
import { formatOnboardingApprovedSms } from "../services/sms.service";
import { applicationRateLimit } from "../lib/rate-limit";

const applicationIdParamSchema = z.object({
  id: z.uuid(),
});

export const applicationRoutes = new Hono<AppBindings>();

applicationRoutes.post(
  "/",
  applicationRateLimit,
  zValidator("json", createApplicationSchema),
  async (c) => {
    try {
      const body = c.req.valid("json");
      const application = await createMeterApplication(body);
      return c.json({ data: application }, 201);
    } catch (error) {
      return handleApplicationError(c, error);
    }
  },
);

applicationRoutes.get(
  "/",
  requireAdmin,
  zValidator("query", applicationQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await listMeterApplications(query);
    return c.json(result);
  },
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
  },
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
      const user = c.get("user");
      await writeAuditLog({
        userId: user.id,
        action: "approve_meter_application",
        entityType: "meter_application",
        entityId: id,
        details: {
          tariffId: body.tariffId,
          createdMeters: approved.createdMeters,
          motherMeterId: approved.motherMeterId,
        },
        ipAddress: extractClientIp(c.req.raw.headers),
      });

      try {
        await smsDeliveryQueue.add(
          "send-notification-sms",
          {
            kind: "notification" as const,
            phoneNumber: approved.phoneNumber,
            messageBody: formatOnboardingApprovedSms({
              landlordName: approved.landlordName,
              motherMeterNumber: approved.motherMeterNumber,
              subMeterCount: approved.createdMeters,
            }),
          },
          {
            jobId: `sms-application-approved-${approved.applicationId}`,
          },
        );
      } catch (notificationError) {
        console.error(
          "[Applications] Failed to queue approval notification:",
          notificationError,
        );
      }

      return c.json({
        message: "Application approved and meters registered",
        data: approved,
      });
    } catch (error) {
      return handleApplicationError(c, error);
    }
  },
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
      const user = c.get("user");
      await writeAuditLog({
        userId: user.id,
        action: "reject_meter_application",
        entityType: "meter_application",
        entityId: id,
        details: { reason },
        ipAddress: extractClientIp(c.req.raw.headers),
      });
      return c.json({
        message: "Application rejected",
        reason,
      });
    } catch (error) {
      return handleApplicationError(c, error);
    }
  },
);

function handleApplicationError(c: Context<AppBindings>, error: unknown) {
  if (error instanceof ApplicationError) {
    return c.json(
      { error: error.message },
      toApplicationStatusCode(error.statusCode),
    );
  }

  console.error("[Applications]", error);
  return c.json({ error: "Internal Server Error" }, 500);
}

function toApplicationStatusCode(statusCode: number): 400 | 404 | 409 {
  if (statusCode === 404) return 404;
  if (statusCode === 409) return 409;
  return 400;
}
