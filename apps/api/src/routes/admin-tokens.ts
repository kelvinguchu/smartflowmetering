import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppBindings } from "../lib/auth-middleware";
import { requirePermission } from "../lib/auth-middleware";
import { maskToken } from "../lib/token-redaction";
import { smsDeliveryQueue } from "../queues";
import { createAdminToken } from "../services/admin-token-operations.service";
import { extractClientIp, writeAuditLog } from "../services/audit-log.service";
import { formatAdminTokenSms } from "../services/sms.service";
import { createAdminTokenSchema } from "../validators/admin-tokens";

export const adminTokenRoutes = new Hono<AppBindings>();

adminTokenRoutes.use("*", requirePermission("admin_tokens:create"));

adminTokenRoutes.post(
  "/",
  zValidator("json", createAdminTokenSchema),
  async (c) => {
    const body = c.req.valid("json");
    const user = c.get("user");
    const result = await createAdminToken(body);

    let smsQueued = false;
    let smsQueueError: string | null = null;

    if (body.delivery === "sms" && body.phoneNumber) {
      try {
        await smsDeliveryQueue.add(
          "send-notification-sms",
          {
            kind: "notification" as const,
            phoneNumber: body.phoneNumber,
            messageBody: formatAdminTokenSms({
              meterNumber: result.meterNumber,
              token: result.token,
              tokenType: result.tokenType,
              power: body.power,
              sgcId: body.sgcId,
            }),
          },
          {
            jobId: `admin-token-sms-${result.generatedTokenId}`,
          },
        );
        smsQueued = true;
      } catch (error) {
        smsQueueError =
          error instanceof Error ? error.message : "Failed to queue SMS delivery";
      }
    }

    await writeAuditLog({
      userId: user.id,
      action: "admin_token_generated",
      entityType: "generated_token",
      entityId: result.generatedTokenId,
      details: {
        meterId: result.meterId,
        meterNumber: result.meterNumber,
        tokenType: result.tokenType,
        reason: body.reason,
        delivery: body.delivery,
        phoneNumber: result.phoneNumber,
        smsQueued,
        smsQueueError,
        power: body.power ?? null,
        sgcId: body.sgcId ?? null,
        providerCode: result.providerCode,
      },
      ipAddress: extractClientIp(c.req.raw.headers),
    });

    return c.json({
      data: {
        generatedTokenId: result.generatedTokenId,
        meterId: result.meterId,
        meterNumber: result.meterNumber,
        meterType: result.meterType,
        tokenType: result.tokenType,
        token: result.token,
        maskedToken: maskToken(result.token),
        delivery: {
          mode: body.delivery,
          phoneNumber: result.phoneNumber,
          queued: smsQueued,
          error: smsQueueError,
        },
      },
    });
  },
);
