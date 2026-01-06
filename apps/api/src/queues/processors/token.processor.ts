import type { Job } from "bullmq";
import { db } from "../../db";
import { transactions, generatedTokens } from "../../db/schema";
import { eq } from "drizzle-orm";
import { env } from "../../config";
import { smsDeliveryQueue } from "../index";
import type { TokenGenerationJob } from "../types";

/**
 * Token Generation Processor
 *
 * This job:
 * 1. Calls the appropriate manufacturer API based on meter brand
 * 2. Stores the generated token
 * 3. Updates transaction status
 * 4. Queues SMS delivery
 */
export async function processTokenGeneration(
  job: Job<TokenGenerationJob>
): Promise<{ token: string }> {
  const {
    transactionId,
    meterId,
    meterNumber,
    brand,
    units,
    supplyGroupCode,
    keyRevisionNumber,
    tariffIndex,
  } = job.data;

  console.log(`[Token] Generating for meter ${meterNumber}, ${units} kWh`);

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
      brand,
      meterNumber,
      units,
      supplyGroupCode,
      keyRevisionNumber,
      tariffIndex,
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
    token,
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

  console.log(`[Token] Generated: ${formatTokenForDisplay(token)}`);

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
    }
  );

  return { token };
}

// Format token for display (add dashes)
function formatTokenForDisplay(token: string): string {
  // 20-digit token -> 1234-5678-9012-3456-7890
  return token.replaceAll(/(.{4})/g, "$1-").slice(0, -1);
}

// Manufacturer API integration
interface TokenRequest {
  brand: "hexing" | "stron" | "conlog";
  meterNumber: string;
  units: string;
  supplyGroupCode: string;
  keyRevisionNumber: number;
  tariffIndex: number;
}

async function generateTokenFromManufacturer(
  request: TokenRequest
): Promise<string> {
  const {
    brand,
    meterNumber,
    units,
    supplyGroupCode,
    keyRevisionNumber,
    tariffIndex,
  } = request;

  // Select API credentials based on brand
  const apiConfig = getApiConfig(brand);

  if (!apiConfig.apiKey || !apiConfig.apiUrl) {
    console.warn(`[Token] ${brand} API not configured, using mock token`);
    return generateMockToken();
  }

  // Make API call to manufacturer
  // Each manufacturer has different API format, this is a generalized example
  const response = await fetch(apiConfig.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiConfig.apiKey}`,
    },
    body: JSON.stringify({
      meter_number: meterNumber,
      amount: units,
      sgc: supplyGroupCode,
      krn: keyRevisionNumber,
      ti: tariffIndex,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Manufacturer API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}

function getApiConfig(brand: "hexing" | "stron" | "conlog"): {
  apiKey: string;
  apiUrl: string;
} {
  switch (brand) {
    case "hexing":
      return { apiKey: env.HEXING_API_KEY, apiUrl: env.HEXING_API_URL };
    case "stron":
      return { apiKey: env.STRON_API_KEY, apiUrl: env.STRON_API_URL };
    case "conlog":
      return { apiKey: env.CONLOG_API_KEY, apiUrl: env.CONLOG_API_URL };
  }
}

// Generate mock token for development/testing
function generateMockToken(): string {
  const digits = "0123456789";
  let token = "";
  for (let i = 0; i < 20; i++) {
    token += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return token;
}
