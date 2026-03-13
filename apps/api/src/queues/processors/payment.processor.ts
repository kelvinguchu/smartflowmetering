import type { Job } from "bullmq";
import { db } from "../../db";
import { meters, transactions, failedTransactions, mpesaTransactions } from "../../db/schema";
import { eq } from "drizzle-orm";
import { env } from "../../config";
import { generateTransactionId } from "../../lib/utils";
import { calculateTransaction, meetsMinimumAmount } from "../../lib/money";
import { sanitizeMpesaPayload } from "../../lib/mpesa-payload-sanitizer";
import {
  maskMeterNumberForLog,
  maskReferenceForLog,
} from "../../lib/log-redaction";
import { tokenGenerationQueue } from "../index";
import type { PaymentJob, PaymentProcessingJob, MpesaRawCallbackJob } from "../types";

/**
 * Payment Processing Processor
 * Handles both raw callbacks and structured payment jobs
 */
export async function processPayment(
  job: Job<PaymentJob>
): Promise<{ transactionId: string } | void> {
  // Handle Raw M-Pesa Callback (New Flow)
  if (job.name === "process-raw-callback") {
    const rawData = job.data as MpesaRawCallbackJob;
    return handleRawCallback(rawData);
  }

  // Handle Structured Payment Job (Internal/Legacy/Retry)
  if (job.name === "process-payment" || job.name === "process-stk-payment") {
    const data = job.data as PaymentProcessingJob;
    return processPaymentInternal(data);
  }

  throw new Error(`Unknown job name: ${job.name}`);
}

/**
 * Handle Raw Callback
 * 1. Store in DB (Idempotent)
 * 2. Proceed to processing
 */
async function handleRawCallback(body: MpesaRawCallbackJob) {
  console.log(
    `[Payment Worker] Handling Raw Callback: ${maskReferenceForLog(body.TransID)}`,
  );

  // 1. Store raw callback (Idempotency via unique trans_id)
  const [mpesaTx] = await db
    .insert(mpesaTransactions)
    .values({
      transactionType: body.TransactionType,
      transId: body.TransID,
      transTime: body.TransTime,
      transAmount: String(body.TransAmount),
      businessShortCode: body.BusinessShortCode,
      billRefNumber: body.BillRefNumber.trim(),
      invoiceNumber: body.InvoiceNumber ?? null,
      orgAccountBalance: body.OrgAccountBalance
        ? String(body.OrgAccountBalance)
        : null,
      thirdPartyTransId: body.ThirdPartyTransID ?? null,
      msisdn: body.MSISDN,
      firstName: body.FirstName ?? null,
      middleName: body.MiddleName ?? null,
      lastName: body.LastName ?? null,
      rawCallbackPayload:
        sanitizeMpesaPayload(body) as Record<string, unknown>,
    })
    .onConflictDoNothing({ target: mpesaTransactions.transId })
    .returning({ id: mpesaTransactions.id });

  let txId: string | undefined = mpesaTx?.id;

  // If duplicate (no insert), fetch existing ID
  if (!txId) {
    const existing = await db.query.mpesaTransactions.findFirst({
      where: eq(mpesaTransactions.transId, body.TransID),
      columns: { id: true },
    });
    // If it exists but we processed it before, we might be re-processing manually?
    // For now, let's proceed. If it was already processed successfully, 
    // the transaction table check (if we had one) would stop it.
    // In this "dumb pipe" model, we just re-run the logic. 
    // Ideally, we check if a 'transactions' record exists for this mpesaTxId.
    txId = existing?.id;
    console.log(
      `[Payment Worker] Duplicate Callback: ${maskReferenceForLog(body.TransID)} (ID: ${txId})`,
    );
  }

  if (!txId) throw new Error("Failed to resolve M-Pesa Transaction ID");

  // 2. Check if we already have a completed transaction for this M-Pesa ID
  const existingTx = await db.query.transactions.findFirst({
    where: eq(transactions.mpesaTransactionId, txId!),
  });

  if (existingTx) {
    console.log(
      `[Payment Worker] Transaction already processed: ${maskReferenceForLog(existingTx.transactionId)}`,
    );
    return { transactionId: existingTx.transactionId };
  }

  // 3. Process Payment Internal
  return processPaymentInternal({
    mpesaTransactionId: txId,
    meterNumber: body.BillRefNumber.trim(),
    amount: String(body.TransAmount),
    phoneNumber: body.MSISDN,
    mpesaReceiptNumber: body.TransID,
    paymentMethod: "paybill",
  });
}

/**
 * Internal logic (Business Logic)
 */
async function processPaymentInternal(data: PaymentProcessingJob) {
  const {
    mpesaTransactionId,
    meterNumber,
    amount,
    phoneNumber,
    mpesaReceiptNumber,
  } = data;

  console.log(
    `[Payment] Processing: ${maskReferenceForLog(mpesaReceiptNumber)} for meter ${maskMeterNumberForLog(meterNumber)}`
  );

  // Step 1: Check minimum amount
  if (!meetsMinimumAmount(amount, env.MIN_TRANSACTION_AMOUNT)) {
    await createFailedTransaction(mpesaTransactionId, {
      reason: "below_minimum",
      details: `Amount ${amount} is below minimum ${env.MIN_TRANSACTION_AMOUNT}`,
      meterNumber,
      amount,
      phoneNumber,
    });
    // We don't throw here to avoid retrying in queue (since it will always fail)
    // We return empty to signal completion without transaction
    console.warn(`[Payment] Failed: Below Minimum (${amount})`);
    return; 
  }

  // Step 2: Find and validate meter
  const meter = await db.query.meters.findFirst({
    where: eq(meters.meterNumber, meterNumber),
    with: {
      tariff: true,
    },
  });

  if (!meter) {
    await createFailedTransaction(mpesaTransactionId, {
      reason: "invalid_meter",
      details: `Meter ${meterNumber} not found`,
      meterNumber,
      amount,
      phoneNumber,
    });
    console.warn(
      `[Payment] Failed: Meter not found (${maskMeterNumberForLog(meterNumber)})`,
    );
    return;
  }

  if (meter.status !== "active") {
    await createFailedTransaction(mpesaTransactionId, {
      reason: "meter_inactive",
      details: `Meter ${meterNumber} is ${meter.status}`,
      meterNumber,
      amount,
      phoneNumber,
    });
    console.warn(
      `[Payment] Failed: Meter inactive (${maskMeterNumberForLog(meterNumber)})`,
    );
    return;
  }

  // Step 3: Calculate transaction amounts
  const calculation = calculateTransaction(
    amount,
    meter.tariff.ratePerKwh,
    env.COMMISSION_RATE
  );

  // Step 4: Create transaction record
  const transactionId = generateTransactionId();

  const [transaction] = await db
    .insert(transactions)
    .values({
      transactionId,
      meterId: meter.id,
      mpesaTransactionId,
      phoneNumber,
      mpesaReceiptNumber,
      amountPaid: calculation.grossAmount,
      commissionAmount: calculation.commissionAmount,
      netAmount: calculation.netAmount,
      rateUsed: calculation.rateUsed,
      unitsPurchased: calculation.unitsPurchased,
      status: "processing",
      paymentMethod: data.paymentMethod ?? "paybill",
    })
    .returning();

  console.log(
    `[Payment] Created transaction: ${maskReferenceForLog(transactionId)}, Units: ${calculation.unitsPurchased}`
  );

  // Step 5: Queue token generation
  await tokenGenerationQueue.add(
    "generate-token",
    {
      transactionId: transaction.id,
      meterId: meter.id,
      meterNumber: meter.meterNumber,
      brand: meter.brand,
      meterType: meter.meterType,
      units: calculation.unitsPurchased,
      supplyGroupCode: meter.supplyGroupCode,
      keyRevisionNumber: meter.keyRevisionNumber,
      tariffIndex: meter.tariffIndex,
    },
    {
      jobId: `token-${transaction.id}`, // Prevent duplicate token generation
      attempts: 3,
      backoff: { type: "exponential", delay: 500 },
    }
  );

  return { transactionId };
}

// Helper to create failed transaction record
async function createFailedTransaction(
  mpesaTransactionId: string,
  data: {
    reason:
      | "invalid_meter"
      | "below_minimum"
      | "manufacturer_error"
      | "sms_failed"
      | "meter_inactive"
      | "other";
    details: string;
    meterNumber: string;
    amount: string;
    phoneNumber: string;
  }
) {
  await db.insert(failedTransactions).values({
    mpesaTransactionId,
    failureReason: data.reason,
    failureDetails: data.details,
    meterNumberAttempted: data.meterNumber,
    amount: data.amount,
    phoneNumber: data.phoneNumber,
    status: "pending_review",
  });
}
