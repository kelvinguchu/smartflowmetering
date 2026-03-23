import { eq } from "drizzle-orm";
import { db } from "../../db";
import { generatedTokens, meters } from "../../db/schema";
import { protectToken } from "../../lib/token-protection";
import type { CreateAdminToken } from "../../validators/admin-tokens";
import { extractToken } from "../meter-providers/gomelong-client";
import {
  getChangeDecoderToken,
  getClearCreditToken,
  getClearTamperSignToken,
  getMaxPowerToken,
  isGomelongConfigured,
} from "../meter-providers/gomelong.service";
import { mapMeterTypeToGomelong } from "../meter-providers/provider-capabilities";

type GeneratedTokenType =
  | "clear_tamper"
  | "clear_credit"
  | "set_power_limit"
  | "key_change";

export interface AdminTokenWorkflowResult {
  meterId: string;
  meterNumber: string;
  meterType: "electricity" | "water" | "gas";
  token: string;
  tokenType: GeneratedTokenType;
  generatedTokenId: string;
  delivery: "none" | "sms";
  phoneNumber: string | null;
  providerCode: number;
  providerMessage: string | null;
  value: string | null;
}

export async function createAdminToken(
  input: CreateAdminToken,
): Promise<AdminTokenWorkflowResult> {
  const meter = await findMeterForAdminToken(input);
  const providerMeterType = mapMeterTypeToProvider(meter.meterType);
  const providerResult = await generateProviderToken(providerMeterType, meter, input);
  const token = extractToken(providerResult.data);

  if (!token) {
    throw new Error("Provider succeeded but no admin token was returned");
  }

  const tokenType = mapActionToTokenType(input.action);
  const value = input.action === "set_power_limit" ? String(input.power) : null;
  const [storedToken] = await db
    .insert(generatedTokens)
    .values({
      meterId: meter.id,
      token: protectToken(token),
      tokenType,
      value,
      generatedBy: "admin",
    })
    .returning({ id: generatedTokens.id });

  return {
    meterId: meter.id,
    meterNumber: meter.meterNumber,
    meterType: meter.meterType,
    token,
    tokenType,
    generatedTokenId: storedToken.id,
    delivery: input.delivery,
    phoneNumber: input.phoneNumber ?? null,
    providerCode: providerResult.code,
    providerMessage: providerResult.message,
    value,
  };
}

function mapActionToTokenType(action: CreateAdminToken["action"]): GeneratedTokenType {
  if (action === "clear_tamper") return "clear_tamper";
  if (action === "clear_credit") return "clear_credit";
  if (action === "set_power_limit") return "set_power_limit";
  return "key_change";
}

async function findMeterForAdminToken(input: CreateAdminToken) {
  const meter = input.meterId
    ? await db.query.meters.findFirst({
        where: eq(meters.id, input.meterId),
        columns: {
          id: true,
          meterNumber: true,
          meterType: true,
          brand: true,
          status: true,
        },
      })
    : await db.query.meters.findFirst({
        where: eq(meters.meterNumber, input.meterNumber!),
        columns: {
          id: true,
          meterNumber: true,
          meterType: true,
          brand: true,
          status: true,
        },
      });

  if (!meter) {
    throw new Error("Meter not found");
  }

  return meter;
}

function mapMeterTypeToProvider(
  meterType: "electricity" | "water" | "gas",
) {
  if (!isGomelongConfigured()) {
    throw new Error("Gomelong credentials are not configured");
  }

  const mapped = mapMeterTypeToGomelong(meterType);
  if (!mapped) {
    throw new Error(`Admin token actions do not support meter type '${meterType}'`);
  }

  return mapped;
}

async function generateProviderToken(
  meterType: 1 | 2,
  meter: {
    id: string;
    meterNumber: string;
    meterType: "electricity" | "water" | "gas";
    brand: "hexing" | "stron" | "conlog";
    status: "active" | "inactive" | "suspended";
  },
  input: CreateAdminToken,
) {
  if (input.action === "clear_tamper") {
    return expectProviderToken(
      await getClearTamperSignToken({
        meterCode: meter.meterNumber,
        meterType,
      }),
      input.action,
    );
  }

  if (input.action === "clear_credit") {
    return expectProviderToken(
      await getClearCreditToken({
        meterCode: meter.meterNumber,
        meterType,
      }),
      input.action,
    );
  }

  if (input.action === "set_power_limit") {
    return expectProviderToken(
      await getMaxPowerToken({
        meterCode: meter.meterNumber,
        power: input.power!,
      }),
      input.action,
    );
  }

  return expectProviderToken(
    await getChangeDecoderToken({
      meterCode: meter.meterNumber,
      meterType,
      sgcId: input.sgcId!,
    }),
    input.action,
  );
}

function expectProviderToken(
  result: {
    code: number;
    message: string | null;
    data: unknown;
    raw: unknown;
  },
  action: CreateAdminToken["action"],
) {
  if (result.code !== 0) {
    throw new Error(
      `Gomelong ${action} failed (${result.code}): ${result.message ?? "unknown error"}`,
    );
  }

  return result;
}




