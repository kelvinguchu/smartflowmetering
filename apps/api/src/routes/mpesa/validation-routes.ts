import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { env } from "../../config";
import { db } from "../../db";
import { meters } from "../../db/schema";
import { mpesaRateLimit } from "../../lib/rate-limit";
import { paymentProcessingQueue } from "../../queues";
import {
  mpesaC2BCallbackSchema,
  mpesaValidationSchema,
} from "../../validators/mpesa";
import { rejectIfInvalidMpesaSource, type MpesaRouter } from "./shared";

export function registerValidationRoutes(router: MpesaRouter) {
  router.post(
    "/validation",
    mpesaRateLimit,
    zValidator("json", mpesaValidationSchema),
    async (c) => {
      const body = c.req.valid("json");
      const rejection = rejectIfInvalidMpesaSource(c, "M-Pesa Validation", {
        ResultCode: "C2B00016",
        ResultDesc: "Forbidden",
      });
      if (rejection) return rejection;

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
        console.log(`[M-Pesa Validation] Rejected: Meter ${meterNumber} not found`);
        return c.json({
          ResultCode: "C2B00013",
          ResultDesc: "Invalid meter number",
        });
      }

      if (meter.status !== "active") {
        console.log(
          `[M-Pesa Validation] Rejected: Meter ${meterNumber} is ${meter.status}`
        );
        return c.json({
          ResultCode: "C2B00014",
          ResultDesc: "Meter is not active",
        });
      }

      console.log(
        `[M-Pesa Validation] Accepted: Meter ${meterNumber}, Amount ${amount}`
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
    zValidator("json", mpesaC2BCallbackSchema),
    async (c) => {
      const body = c.req.valid("json");
      const rejection = rejectIfInvalidMpesaSource(c, "M-Pesa Callback", {
        ResultCode: "1",
        ResultDesc: "Forbidden",
      });
      if (rejection) return rejection;

      console.log(`[M-Pesa Callback] Received: ${body.TransID}`);

      try {
        await paymentProcessingQueue.add("process-raw-callback", body, {
          jobId: `raw-mpesa-${body.TransID}`,
          removeOnComplete: true,
        });

        console.log(`[M-Pesa Callback] Queued raw callback: ${body.TransID}`);
      } catch (error) {
        console.error("[M-Pesa Callback] Error queuing transaction:", error);
      }

      return c.json({
        ResultCode: "0",
        ResultDesc: "Accepted",
      });
    }
  );

  router.get("/health", (c) =>
    c.json({
      status: "ok",
      shortcode: env.MPESA_SHORTCODE,
      environment: env.MPESA_ENVIRONMENT,
    })
  );
}
