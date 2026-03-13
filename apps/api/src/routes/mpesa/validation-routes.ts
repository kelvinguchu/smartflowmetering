import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { env } from "../../config";
import { db } from "../../db";
import { meters } from "../../db/schema";
import type { AppBindings } from "../../lib/auth-middleware";
import { requirePermission } from "../../lib/auth-middleware";
import { maskMeterNumberForLog, maskReferenceForLog } from "../../lib/log-redaction";
import { mpesaRateLimit } from "../../lib/rate-limit";
import { paymentProcessingQueue } from "../../queues";
import {
  mpesaC2BCallbackSchema,
  mpesaValidationSchema,
} from "../../validators/mpesa";
import { rejectIfInvalidMpesaSource } from "./shared";
import type { MpesaRouter } from "./shared";

export function registerValidationRoutes(router: MpesaRouter) {
  const guardValidationSource = async (
    c: Context<AppBindings>,
    next: () => Promise<void>,
  ) => {
    const rejection = await rejectIfInvalidMpesaSource(c, "M-Pesa Validation", {
      ResultCode: "C2B00016",
      ResultDesc: "Forbidden",
    });
    if (rejection) {
      return rejection;
    }
    await next();
  };

  const guardCallbackSource = async (
    c: Context<AppBindings>,
    next: () => Promise<void>,
  ) => {
    const rejection = await rejectIfInvalidMpesaSource(c, "M-Pesa Callback", {
      ResultCode: "1",
      ResultDesc: "Forbidden",
    });
    if (rejection) {
      return rejection;
    }
    await next();
  };

  router.post(
    "/validation",
    mpesaRateLimit,
    guardValidationSource,
    zValidator("json", mpesaValidationSchema),
    async (c) => {
      const body = c.req.valid("json");
      const meterNumber = body.BillRefNumber.trim();
      const amount = Number.parseFloat(String(body.TransAmount));

      if (amount < env.MIN_TRANSACTION_AMOUNT) {
        console.log(
          `[M-Pesa Validation] Rejected: Amount ${amount} below minimum ${env.MIN_TRANSACTION_AMOUNT}`
        );
        return c.json({
          ResultCode: "C2B00012",
          ResultDesc: `Minimum amount is KES ${env.MIN_TRANSACTION_AMOUNT}`,
        });
      }

      const meter = await db.query.meters.findFirst({
        where: eq(meters.meterNumber, meterNumber),
        columns: { id: true, status: true },
      });

      if (!meter) {
        console.log(
          `[M-Pesa Validation] Rejected: Meter ${maskMeterNumberForLog(meterNumber)} not found`,
        );
        return c.json({
          ResultCode: "C2B00013",
          ResultDesc: "Invalid meter number",
        });
      }

      if (meter.status !== "active") {
        console.log(
          `[M-Pesa Validation] Rejected: Meter ${maskMeterNumberForLog(meterNumber)} is ${meter.status}`
        );
        return c.json({
          ResultCode: "C2B00014",
          ResultDesc: "Meter is not active",
        });
      }

      console.log(
        `[M-Pesa Validation] Accepted: Meter ${maskMeterNumberForLog(meterNumber)}, Amount ${amount}`
      );
      return c.json({
        ResultCode: "0",
        ResultDesc: "Accepted",
      });
    }
  );

  router.post(
    "/callback",
    mpesaRateLimit,
    guardCallbackSource,
    zValidator("json", mpesaC2BCallbackSchema),
    async (c) => {
      const body = c.req.valid("json");
      console.log(
        `[M-Pesa Callback] Received: ${maskReferenceForLog(body.TransID)}`,
      );

      try {
        await paymentProcessingQueue.add("process-raw-callback", body, {
          jobId: `raw-mpesa-${body.TransID}`,
          removeOnComplete: true,
        });

        console.log(
          `[M-Pesa Callback] Queued raw callback: ${maskReferenceForLog(body.TransID)}`,
        );
      } catch (error) {
        console.error("[M-Pesa Callback] Error queuing transaction:", error);
      }

      return c.json({
        ResultCode: "0",
        ResultDesc: "Accepted",
      });
    }
  );

  router.get("/health", requirePermission("mpesa:health:read"), (c) =>
    c.json({
      status: "ok",
      shortcode: env.MPESA_SHORTCODE,
      environment: env.MPESA_ENVIRONMENT,
    })
  );
}
