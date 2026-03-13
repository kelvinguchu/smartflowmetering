import type { Job } from "bullmq";
import { db } from "../../db";
import { transactions, generatedTokens } from "../../db/schema";
import { eq } from "drizzle-orm";
import { env } from "../../config";
import { protectToken } from "../../lib/token-protection";
import { maskToken } from "../../lib/token-redaction";
import { maskMeterNumberForLog } from "../../lib/log-redaction";
import { smsDeliveryQueue } from "../index";
import type { TokenGenerationJob } from "../types";
import {
  isGomelongConfigured,
  vendTokenWithGomelong,
} from "../../services/meter-providers/gomelong.service";
import { mapMeterTypeToGomelong } from "../../services/meter-providers/provider-capabilities";

type MeterUtilityType = "electricity" | "water" | "gas";

/**
 * Token Generation Processor
 *
 * This job:
 * 1. Generates a token through Gomelong
 * 2. Stores the generated token
 * 3. Updates transaction status
 * 4. Queues SMS delivery
 */
export async function processTokenGeneration(
  job: Job<TokenGenerationJob>,
): Promise<{ token: string }> {
  const {
    transactionId,
    meterId,
    meterNumber,
    meterType,
    units,
  } = job.data;

  console.log(
    `[Token] Generating for meter ${maskMeterNumberForLog(meterNumber)}, ${units} kWh`,
  );

  // Get the transaction to fetch phone number
  const transaction = await db.query.transactions.findFirst({
    where: eq(transactions.id, transactionId),
    columns: { phoneNumber: true, amountPaid: true },
  });

  if (!transaction) {
    throw new Error(`Transaction ${transactionId} not found`);
  }

  // Call manufacturer API
  let token: string;
  try {
    token = await generateTokenFromManufacturer({
      meterType,
      meterNumber,
      units,
    });
  } catch (error) {
    // Update transaction as failed
    await db
      .update(transactions)
      .set({ status: "failed" })
      .where(eq(transactions.id, transactionId));
    throw error;
  }

  // Store the token
  await db.insert(generatedTokens).values({
    meterId,
    transactionId,
    token: protectToken(token),
    tokenType: "credit",
    value: units,
    generatedBy: "system",
  });

  // Update transaction as completed
  await db
    .update(transactions)
    .set({
      status: "completed",
      completedAt: new Date(),
    })
    .where(eq(transactions.id, transactionId));

  console.log(`[Token] Generated: ${maskToken(token)}`);

  // Queue SMS delivery
  await smsDeliveryQueue.add(
    "send-sms",
    {
      transactionId,
      phoneNumber: transaction.phoneNumber,
      meterNumber,
      token,
      units,
      amount: transaction.amountPaid,
    },
    {
      jobId: `sms-${transactionId}`,
    },
  );

  return { token };
}

// Manufacturer API integration
interface TokenRequest {
  meterType: MeterUtilityType;
  meterNumber: string;
  units: string;
}

async function generateTokenFromManufacturer(
  request: TokenRequest,
): Promise<string> {
  const { meterType, meterNumber, units } = request;

  const mappedType = mapMeterTypeToGomelong(meterType);
  if (!mappedType) {
    throw new Error(
      `Gomelong does not support meter type '${meterType}' for meter ${meterNumber}`,
    );
  }

  if (!isGomelongConfigured()) {
    throw new Error("Gomelong credentials are not configured");
  }

  const quantity = Number.parseFloat(units);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Invalid units for Gomelong vending: ${units}`);
  }

  return vendTokenWithGomelong({
    meterCode: meterNumber,
    meterType: mappedType,
    amountOrQuantity: quantity,
    vendingType: env.GOMELONG_VENDING_TYPE,
  });
}
