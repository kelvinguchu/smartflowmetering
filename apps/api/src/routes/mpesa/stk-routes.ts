import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { env } from "../../config";
import { db } from "../../db";
import { mpesaTransactions } from "../../db/schema";
import { requireAuth } from "../../lib/auth-middleware";
import { formatPhoneNumber } from "../../lib/utils";
import { mpesaRateLimit, stkPushRateLimit } from "../../lib/rate-limit";
import { paymentProcessingQueue } from "../../queues";
import {
  initiateStkPush,
  parseStkCallback,
  queryStkPushStatus,
} from "../../services/mpesa.service";
import {
  stkPushCallbackSchema,
  stkPushQuerySchema,
  stkPushRequestSchema,
} from "../../validators/mpesa";
import { formatMpesaTimestamp, rejectIfInvalidMpesaSource, type MpesaRouter } from "./shared";

export function registerStkRoutes(router: MpesaRouter) {
  router.post(
    "/stk-push",
    requireAuth,
    stkPushRateLimit,
    zValidator("json", stkPushRequestSchema),
    async (c) => {
      const body = c.req.valid("json");
      const { phoneNumber, amount, accountReference, meterNumber, transactionDesc } = body;
      const formattedPhone = formatPhoneNumber(phoneNumber);

      if (!/^254[17]\d{8}$/.test(formattedPhone)) {
        return c.json({
          success: false,
          error: "Invalid phone number format. Must be a valid Kenyan phone number.",
        });
      }

      if (amount < 10) {
        return c.json({
          success: false,
          error: "Minimum amount is KES 10",
        });
      }

      const reference = meterNumber || accountReference || `SFM${Date.now()}`;

      try {
        const result = await initiateStkPush({
          phoneNumber: formattedPhone,
          amount,
          accountReference: reference,
          transactionDesc: transactionDesc || "Smart Flow Metering Token Purchase",
        });

        if (!result.success) {
          return c.json({
            success: false,
            error: result.error,
            errorCode: result.errorCode,
          });
        }

        await db.insert(mpesaTransactions).values({
          transactionType: "STK_PUSH",
          transId: result.checkoutRequestId!,
          transTime: formatMpesaTimestamp(),
          transAmount: amount.toString(),
          businessShortCode: env.MPESA_SHORTCODE,
          billRefNumber: reference,
          invoiceNumber: result.merchantRequestId,
          msisdn: formattedPhone,
          firstName: "STK",
          middleName: "",
          lastName: "Push",
          thirdPartyTransId: "",
          rawPayload: result,
          status: "pending",
        });

        return c.json({
          success: true,
          message: "STK Push initiated. Check your phone for the payment prompt.",
          checkoutRequestId: result.checkoutRequestId,
          merchantRequestId: result.merchantRequestId,
        });
      } catch (error) {
        console.error("[STK Push] Error:", error);
        return c.json({
          success: false,
          error: "Failed to initiate STK Push. Please try again.",
        });
      }
    }
  );

  router.post(
    "/stk-push/callback",
    mpesaRateLimit,
    zValidator("json", stkPushCallbackSchema),
    async (c) => {
      const body = c.req.valid("json");
      const rejection = await rejectIfInvalidMpesaSource(c, "STK Callback", {
        ResultCode: 1,
        ResultDesc: "Forbidden",
      });
      if (rejection) return rejection;

      console.log("[STK Callback] Received:", JSON.stringify(body, null, 2));

      try {
        const parsed = parseStkCallback(body);
        const [existingTx] = await db
          .select()
          .from(mpesaTransactions)
          .where(eq(mpesaTransactions.transId, parsed.checkoutRequestId))
          .limit(1);

        if (!existingTx) {
          console.error("[STK Callback] Transaction not found:", parsed.checkoutRequestId);
          return c.json({ ResultCode: "0", ResultDesc: "Accepted" });
        }

        if (parsed.success && parsed.mpesaReceiptNumber) {
          const existingPayload =
            (existingTx.rawPayload as Record<string, unknown>) || {};
          await db
            .update(mpesaTransactions)
            .set({
              transId: parsed.mpesaReceiptNumber,
              status: "received",
              rawPayload: { ...existingPayload, callback: body },
            })
            .where(eq(mpesaTransactions.id, existingTx.id));

          await paymentProcessingQueue.add(
            "process-stk-payment",
            {
              mpesaTransactionId: existingTx.id,
            meterNumber: existingTx.billRefNumber,
            amount: existingTx.transAmount,
            phoneNumber: existingTx.msisdn,
            mpesaReceiptNumber: parsed.mpesaReceiptNumber,
            paymentMethod: "stk_push",
          },
            {
              attempts: 3,
              backoff: { type: "exponential", delay: 5000 },
            }
          );
        } else {
          const existingPayload =
            (existingTx.rawPayload as Record<string, unknown>) || {};
          await db
            .update(mpesaTransactions)
            .set({
              status: "failed",
              rawPayload: {
                ...existingPayload,
                callback: body,
                failureReason: parsed.resultDesc,
              },
            })
            .where(eq(mpesaTransactions.id, existingTx.id));
        }
      } catch (error) {
        console.error("[STK Callback] Error processing:", error);
      }

      return c.json({ ResultCode: "0", ResultDesc: "Accepted" });
    }
  );

  router.get(
    "/stk-push/query/:checkoutRequestId",
    requireAuth,
    zValidator("param", stkPushQuerySchema),
    async (c) => {
      const { checkoutRequestId } = c.req.valid("param");

      try {
        const [tx] = await db
          .select()
          .from(mpesaTransactions)
          .where(eq(mpesaTransactions.transId, checkoutRequestId))
          .limit(1);

        if (tx) {
          return c.json({
            success: true,
            status: tx.status,
            amount: tx.transAmount,
            phoneNumber: tx.msisdn,
            accountReference: tx.billRefNumber,
            source: "database",
          });
        }

        const result = await queryStkPushStatus(checkoutRequestId);
        return c.json({
          success: result.success,
          status: result.success ? "completed" : "failed",
          resultCode: result.resultCode,
          resultDesc: result.resultDesc,
          source: "mpesa_api",
        });
      } catch (error) {
        console.error("[STK Query] Error:", error);
        return c.json({
          success: false,
          error: "Failed to query STK Push status",
        });
      }
    }
  );
}
