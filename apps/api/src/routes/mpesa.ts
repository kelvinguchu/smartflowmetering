import { Elysia } from "elysia";
import { db } from "../db";
import {
  mpesaTransactions,
  meters,
  tariffs,
  customers,
  properties,
  motherMeters,
} from "../db/schema";
import {
  mpesaC2BCallbackSchema,
  mpesaValidationSchema,
  stkPushRequestSchema,
  stkPushCallbackSchema,
  stkPushQuerySchema,
} from "../validators/mpesa";
import { env } from "../config";

// Helper: Only require admin in production for test endpoints
const testEndpointAuth =
  env.NODE_ENV === "production" ? { adminOnly: true as const } : {};
import { eq } from "drizzle-orm";
import { paymentProcessingQueue } from "../queues";
import {
  initiateStkPush,
  parseStkCallback,
  queryStkPushStatus,
} from "../services/mpesa.service";
import { formatPhoneNumber } from "../lib/utils";
import { authMiddleware } from "../lib/auth-middleware";
import { isValidMpesaIP, getClientIP } from "../lib/mpesa-validation";

/**
 * M-Pesa Routes
 *
 * Handles:
 * - C2B Validation URL (validates meter exists before payment)
 * - C2B Confirmation URL (receives payment notification)
 */
export const mpesaRoutes = new Elysia({ prefix: "/mpesa" })
  .use(authMiddleware)
  /**
   * Validation URL
   * Called by M-Pesa before processing payment
   * Must respond within 3 seconds
   */
  .post(
    "/validation",
    async ({ body, request, set }) => {
      // Validate request comes from Safaricom IP (production only)
      const clientIP = getClientIP(request.headers);
      if (!isValidMpesaIP(clientIP)) {
        console.warn(
          `[M-Pesa Validation] Rejected: Invalid source IP ${clientIP}`
        );
        set.status = 403;
        return { ResultCode: "C2B00016", ResultDesc: "Forbidden" };
      }

      const meterNumber = body.BillRefNumber.trim();
      const amount = Number.parseFloat(String(body.TransAmount));

      // Check minimum amount
      if (amount < env.MIN_TRANSACTION_AMOUNT) {
        console.log(
          `[M-Pesa Validation] Rejected: Amount ${amount} below minimum ${env.MIN_TRANSACTION_AMOUNT}`
        );
        return {
          ResultCode: "C2B00012",
          ResultDesc: `Minimum amount is KES ${env.MIN_TRANSACTION_AMOUNT}`,
        };
      }

      // Check if meter exists and is active
      const meter = await db.query.meters.findFirst({
        where: eq(meters.meterNumber, meterNumber),
        columns: { id: true, status: true },
      });

      if (!meter) {
        console.log(
          `[M-Pesa Validation] Rejected: Meter ${meterNumber} not found`
        );
        return {
          ResultCode: "C2B00013",
          ResultDesc: "Invalid meter number",
        };
      }

      if (meter.status !== "active") {
        console.log(
          `[M-Pesa Validation] Rejected: Meter ${meterNumber} is ${meter.status}`
        );
        return {
          ResultCode: "C2B00014",
          ResultDesc: "Meter is not active",
        };
      }

      // Accept the transaction
      console.log(
        `[M-Pesa Validation] Accepted: Meter ${meterNumber}, Amount ${amount}`
      );
      return {
        ResultCode: "0",
        ResultDesc: "Accepted",
      };
    },
    {
      body: mpesaValidationSchema,
    }
  )

  /**
   * Confirmation URL (Callback)
   * Called by M-Pesa after payment is complete
   * CRITICAL: Must respond immediately (< 1 second), then process async
   */
  .post(
    "/callback",
    async ({ body, request, set }) => {
      // Validate request comes from Safaricom IP (production only)
      const clientIP = getClientIP(request.headers);
      if (!isValidMpesaIP(clientIP)) {
        console.warn(
          `[M-Pesa Callback] Rejected: Invalid source IP ${clientIP}`
        );
        set.status = 403;
        return { ResultCode: "1", ResultDesc: "Forbidden" };
      }

      console.log(`[M-Pesa Callback] Received: ${body.TransID}`);

      console.log(`[M-Pesa Callback] Received: ${body.TransID}`);

      try {
        // Queue the raw callback for async processing (Dump Pipe Architecture)
        // We do absolutely NO database operations here to ensure high availability
        // even if Postgres is down.
        await paymentProcessingQueue.add("process-raw-callback", body, {
          jobId: `raw-mpesa-${body.TransID}`, // Prevent duplicate queuing
          removeOnComplete: true,
        });

        console.log(`[M-Pesa Callback] Queued raw callback: ${body.TransID}`);
      } catch (error) {
        // Log error but still return success to M-Pesa
        console.error(`[M-Pesa Callback] Error queuing transaction:`, error);
      }

      // ALWAYS return success to M-Pesa immediately
      return {
        ResultCode: "0",
        ResultDesc: "Accepted",
      };
    },
    {
      body: mpesaC2BCallbackSchema,
    }
  )

  /**
   * Health check for M-Pesa integration
   */
  .get("/health", () => ({
    status: "ok",
    shortcode: env.MPESA_SHORTCODE,
    environment: env.MPESA_ENVIRONMENT,
  }))

  /**
   * STK Push - Initiate payment request to customer's phone
   * This sends a payment prompt directly to the customer's phone
   */
  .post(
    "/stk-push",
    async ({ body }) => {
      const {
        phoneNumber,
        amount,
        accountReference,
        meterNumber,
        transactionDesc,
      } = body;

      // Format phone number to M-Pesa format
      const formattedPhone = formatPhoneNumber(phoneNumber);

      // Validate phone number
      if (!/^254[17]\d{8}$/.test(formattedPhone)) {
        return {
          success: false,
          error:
            "Invalid phone number format. Must be a valid Kenyan phone number.",
        };
      }

      // Validate amount (minimum KES 10 for M-Pesa)
      if (amount < 10) {
        return {
          success: false,
          error: "Minimum amount is KES 10",
        };
      }

      // Use meterNumber or accountReference, or generate one
      const reference = meterNumber || accountReference || `OHM${Date.now()}`;

      try {
        const result = await initiateStkPush({
          phoneNumber: formattedPhone,
          amount,
          accountReference: reference,
          transactionDesc: transactionDesc || "OhmKenya Token Purchase",
        });

        if (!result.success) {
          return {
            success: false,
            error: result.error,
            errorCode: result.errorCode,
          };
        }

        // Store pending STK Push transaction
        await db.insert(mpesaTransactions).values({
          transactionType: "STK_PUSH",
          transId: result.checkoutRequestId!, // Use CheckoutRequestID as temp ID
          transTime: new Date()
            .toISOString()
            .replaceAll(/[-:T]/g, "")
            .slice(0, 14),
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

        return {
          success: true,
          message:
            "STK Push initiated. Check your phone for the payment prompt.",
          checkoutRequestId: result.checkoutRequestId,
          merchantRequestId: result.merchantRequestId,
        };
      } catch (error) {
        console.error("[STK Push] Error:", error);
        return {
          success: false,
          error: "Failed to initiate STK Push. Please try again.",
        };
      }
    },
    {
      body: stkPushRequestSchema,
      detail: {
        summary: "Initiate STK Push",
        description:
          "Send a payment prompt to customer's phone via M-Pesa STK Push",
        tags: ["M-Pesa", "STK Push"],
      },
      auth: true,
    }
  )

  /**
   * STK Push Callback - Receives payment result from M-Pesa
   */
  .post(
    "/stk-push/callback",
    async ({ body, request, set }) => {
      // Validate request comes from Safaricom IP (production only)
      const clientIP = getClientIP(request.headers);
      if (!isValidMpesaIP(clientIP)) {
        console.warn(`[STK Callback] Rejected: Invalid source IP ${clientIP}`);
        set.status = 403;
        return { ResultCode: 1, ResultDesc: "Forbidden" };
      }

      console.log("[STK Callback] Received:", JSON.stringify(body, null, 2));

      try {
        const parsed = parseStkCallback(body);

        // Find the pending transaction by CheckoutRequestID
        const [existingTx] = await db
          .select()
          .from(mpesaTransactions)
          .where(eq(mpesaTransactions.transId, parsed.checkoutRequestId))
          .limit(1);

        if (!existingTx) {
          console.error(
            "[STK Callback] Transaction not found:",
            parsed.checkoutRequestId
          );
          // Still return success to M-Pesa
          return { ResultCode: "0", ResultDesc: "Accepted" };
        }

        if (parsed.success && parsed.mpesaReceiptNumber) {
          // Payment successful - update transaction and queue for processing
          const existingPayload =
            (existingTx.rawPayload as Record<string, unknown>) || {};
          await db
            .update(mpesaTransactions)
            .set({
              transId: parsed.mpesaReceiptNumber, // Update with actual M-Pesa receipt
              status: "received",
              rawPayload: { ...existingPayload, callback: body },
            })
            .where(eq(mpesaTransactions.id, existingTx.id));

          // Queue for payment processing
          await paymentProcessingQueue.add(
            "process-stk-payment",
            {
              mpesaTransactionId: existingTx.id,
              meterNumber: existingTx.billRefNumber, // billRefNumber contains the meter number
              amount: existingTx.transAmount, // Keep as string
              phoneNumber: existingTx.msisdn,
              mpesaReceiptNumber: parsed.mpesaReceiptNumber,
            },
            {
              attempts: 3,
              backoff: { type: "exponential", delay: 5000 },
            }
          );

          console.log(
            "[STK Callback] Payment successful:",
            parsed.mpesaReceiptNumber
          );
        } else {
          // Payment failed or cancelled
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

          console.log("[STK Callback] Payment failed:", parsed.resultDesc);
        }
      } catch (error) {
        console.error("[STK Callback] Error processing:", error);
      }

      // Always return success to M-Pesa
      return { ResultCode: "0", ResultDesc: "Accepted" };
    },
    {
      body: stkPushCallbackSchema,
      detail: {
        summary: "STK Push Callback",
        description: "Callback endpoint for M-Pesa STK Push results",
        tags: ["M-Pesa", "STK Push", "Callback"],
      },
    }
  )

  /**
   * Query STK Push status
   */
  .get(
    "/stk-push/query/:checkoutRequestId",
    async ({ params }) => {
      const { checkoutRequestId } = params;

      try {
        // First check our database
        const [tx] = await db
          .select()
          .from(mpesaTransactions)
          .where(eq(mpesaTransactions.transId, checkoutRequestId))
          .limit(1);

        if (tx) {
          return {
            success: true,
            status: tx.status,
            amount: tx.transAmount,
            phoneNumber: tx.msisdn,
            accountReference: tx.billRefNumber,
            source: "database",
          };
        }

        // Query M-Pesa directly if not found or still pending
        const result = await queryStkPushStatus(checkoutRequestId);

        return {
          success: result.success,
          status: result.success ? "completed" : "failed",
          resultCode: result.resultCode,
          resultDesc: result.resultDesc,
          source: "mpesa_api",
        };
      } catch (error) {
        console.error("[STK Query] Error:", error);
        return {
          success: false,
          error: "Failed to query STK Push status",
        };
      }
    },
    {
      params: stkPushQuerySchema,
      detail: {
        summary: "Query STK Push Status",
        description: "Check the status of an STK Push transaction",
        tags: ["M-Pesa", "STK Push"],
      },
      auth: true,
    }
  )

  /**
   * Test STK Push endpoint (for development only)
   * Pre-configured with test phone number and meter
   */
  .post(
    "/stk-push/test",
    async ({ body }) => {
      // Cast body to expected shape (optional fields for test endpoint)
      const testBody = body as
        | { phoneNumber?: string; amount?: number; meterNumber?: string }
        | undefined;

      // Use provided values or defaults
      const testPhone = testBody?.phoneNumber || "254725799783";
      const testAmount = testBody?.amount || 35;
      const testMeterNumber = testBody?.meterNumber || "TEST-METER-001";

      console.log(
        `[STK Test] Initiating test payment to ${testPhone} for KES ${testAmount} (Meter: ${testMeterNumber})`
      );

      const formattedPhone = formatPhoneNumber(testPhone);

      try {
        const result = await initiateStkPush({
          phoneNumber: formattedPhone,
          amount: testAmount,
          accountReference: testMeterNumber,
          transactionDesc: `OhmKenya Token for ${testMeterNumber}`,
        });

        if (!result.success) {
          return {
            success: false,
            error: result.error,
            errorCode: result.errorCode,
            environment: env.MPESA_ENVIRONMENT,
          };
        }

        // Store test transaction with meter number as billRefNumber
        await db.insert(mpesaTransactions).values({
          transactionType: "STK_PUSH",
          transId: result.checkoutRequestId!,
          transTime: new Date()
            .toISOString()
            .replaceAll(/[-:T]/g, "")
            .slice(0, 14),
          transAmount: testAmount.toString(),
          businessShortCode: env.MPESA_SHORTCODE,
          billRefNumber: testMeterNumber,
          invoiceNumber: result.merchantRequestId,
          msisdn: formattedPhone,
          firstName: "Test",
          middleName: "",
          lastName: "User",
          thirdPartyTransId: "",
          rawPayload: result,
          status: "pending",
        });

        return {
          success: true,
          message: `STK Push sent to ${testPhone}. Check your phone!`,
          meterNumber: testMeterNumber,
          checkoutRequestId: result.checkoutRequestId,
          merchantRequestId: result.merchantRequestId,
          environment: env.MPESA_ENVIRONMENT,
          callbackUrl: `${env.MPESA_CALLBACK_URL}/stk-push/callback`,
          note:
            env.MPESA_ENVIRONMENT === "sandbox"
              ? "Using sandbox - enter any PIN to simulate payment"
              : "Using production - real payment will be processed",
        };
      } catch (error) {
        console.error("[STK Test] Error:", error);
        return {
          success: false,
          error: "Failed to initiate test STK Push",
          environment: env.MPESA_ENVIRONMENT,
        };
      }
    },
    {
      detail: {
        summary: "Test STK Push",
        description:
          "Test endpoint for STK Push with pre-configured test phone (254725799783) and meter (TEST-METER-001)",
        tags: ["M-Pesa", "STK Push", "Testing"],
      },
      ...testEndpointAuth,
    }
  )

  /**
   * Setup test data for development
   * Creates a test tariff, customer, property, mother meter, and meter
   */
  .post(
    "/test/setup",
    async () => {
      try {
        // Check if test data already exists
        const existingMeter = await db.query.meters.findFirst({
          where: eq(meters.meterNumber, "TEST-METER-001"),
        });

        if (existingMeter) {
          return {
            success: true,
            message: "Test data already exists",
            meterNumber: "TEST-METER-001",
            meterId: existingMeter.id,
          };
        }

        // Create test tariff
        const [testTariff] = await db
          .insert(tariffs)
          .values({
            name: "Test Tariff",
            ratePerKwh: "25.0000",
            currency: "KES",
          })
          .onConflictDoNothing()
          .returning();

        // Get the tariff (either newly created or existing)
        const tariff =
          testTariff ||
          (await db.query.tariffs.findFirst({
            where: eq(tariffs.name, "Test Tariff"),
          }));

        if (!tariff) {
          throw new Error("Failed to create or find test tariff");
        }

        // Create test customer (landlord)
        // Note: userId would normally come from Better-Auth, using a placeholder UUID for testing
        const testUserId = crypto.randomUUID();
        const [testCustomer] = await db
          .insert(customers)
          .values({
            userId: testUserId,
            name: "Test Landlord",
            phoneNumber: "254725799783",
            customerType: "landlord",
          })
          .returning();

        // Create test property
        const [testProperty] = await db
          .insert(properties)
          .values({
            name: "Test Property",
            location: "Nairobi, Kenya",
            numberOfUnits: 10,
            landlordId: testCustomer.id,
          })
          .returning();

        // Create test mother meter
        const [testMotherMeter] = await db
          .insert(motherMeters)
          .values({
            motherMeterNumber: "MM-TEST-001",
            type: "prepaid",
            landlordId: testCustomer.id,
            tariffId: tariff.id,
            propertyId: testProperty.id,
            totalCapacity: "100.00",
            lowBalanceThreshold: "1000",
          })
          .returning();

        // Create test meter
        const [testMeter] = await db
          .insert(meters)
          .values({
            meterNumber: "TEST-METER-001",
            meterType: "electricity",
            brand: "hexing",
            motherMeterId: testMotherMeter.id,
            tariffId: tariff.id,
            supplyGroupCode: "600675",
            keyRevisionNumber: 1,
            tariffIndex: 1,
            status: "active",
          })
          .returning();

        console.log("[Test Setup] Created test data:", {
          tariff: tariff.id,
          customer: testCustomer.id,
          property: testProperty.id,
          motherMeter: testMotherMeter.id,
          meter: testMeter.id,
        });

        return {
          success: true,
          message: "Test data created successfully",
          data: {
            tariffId: tariff.id,
            customerId: testCustomer.id,
            propertyId: testProperty.id,
            motherMeterId: testMotherMeter.id,
            meterId: testMeter.id,
            meterNumber: "TEST-METER-001",
          },
          nextSteps: [
            "POST /api/mpesa/stk-push/test - Initiate STK Push",
            "POST /api/mpesa/stk-push/simulate-callback - Simulate callback (for local testing)",
            "The callback will process payment and generate token",
          ],
        };
      } catch (error) {
        console.error("[Test Setup] Error:", error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to create test data",
        };
      }
    },
    {
      detail: {
        summary: "Setup Test Data",
        description:
          "Create test tariff, customer, property, and meter for development testing",
        tags: ["M-Pesa", "Testing"],
      },
      ...testEndpointAuth,
    }
  )

  /**
   * Simulate STK Push callback (for local testing without ngrok)
   */
  .post(
    "/stk-push/simulate-callback",
    async ({ body }) => {
      // Handle missing body
      if (!body) {
        return {
          success: false,
          error:
            "Request body is required. Send JSON with { checkoutRequestId: string, success?: boolean }",
        };
      }

      const { checkoutRequestId, success = true } = body as {
        checkoutRequestId: string;
        success?: boolean;
      };

      if (!checkoutRequestId) {
        return { success: false, error: "checkoutRequestId is required" };
      }

      // Find the pending transaction
      const [pendingTx] = await db
        .select()
        .from(mpesaTransactions)
        .where(eq(mpesaTransactions.transId, checkoutRequestId))
        .limit(1);

      if (!pendingTx) {
        return { success: false, error: "Transaction not found" };
      }

      if (pendingTx.status !== "pending") {
        return {
          success: false,
          error: `Transaction already ${pendingTx.status}`,
        };
      }

      // Generate a mock M-Pesa receipt
      const mockReceiptNumber = `SIM${Date.now().toString().slice(-10)}`;

      if (success) {
        // Update transaction to received
        await db
          .update(mpesaTransactions)
          .set({
            transId: mockReceiptNumber,
            status: "received",
            rawPayload: {
              ...((pendingTx.rawPayload as Record<string, unknown>) || {}),
              simulatedCallback: {
                success: true,
                mpesaReceiptNumber: mockReceiptNumber,
                simulatedAt: new Date().toISOString(),
              },
            },
          })
          .where(eq(mpesaTransactions.id, pendingTx.id));

        // Queue for payment processing
        await paymentProcessingQueue.add(
          "process-stk-payment",
          {
            mpesaTransactionId: pendingTx.id,
            meterNumber: pendingTx.billRefNumber,
            amount: pendingTx.transAmount,
            phoneNumber: pendingTx.msisdn,
            mpesaReceiptNumber: mockReceiptNumber,
          },
          {
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
          }
        );

        console.log(
          `[Simulate Callback] Queued payment for processing: ${mockReceiptNumber}`
        );

        return {
          success: true,
          message: "Callback simulated successfully",
          mockReceiptNumber,
          meterNumber: pendingTx.billRefNumber,
          amount: pendingTx.transAmount,
          status: "queued_for_processing",
        };
      } else {
        // Mark as failed
        await db
          .update(mpesaTransactions)
          .set({
            status: "failed",
            rawPayload: {
              ...((pendingTx.rawPayload as Record<string, unknown>) || {}),
              simulatedCallback: {
                success: false,
                reason: "User cancelled",
                simulatedAt: new Date().toISOString(),
              },
            },
          })
          .where(eq(mpesaTransactions.id, pendingTx.id));

        return {
          success: true,
          message: "Failed callback simulated",
          status: "failed",
        };
      }
    },
    {
      detail: {
        summary: "Simulate STK Callback",
        description: "Simulate M-Pesa callback for local testing without ngrok",
        tags: ["M-Pesa", "STK Push", "Testing"],
      },
      ...testEndpointAuth,
    }
  );
