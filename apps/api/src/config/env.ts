// Environment configuration with runtime validation
// All env vars are validated at startup

// Node environment
const NODE_ENV = (process.env.NODE_ENV ?? "development") as
  | "development"
  | "production"
  | "test";

const isProduction = NODE_ENV === "production";
const MPESA_ENVIRONMENT = normalizeMpesaEnvironment(
  process.env.MPESA_ENVIRONMENT ?? process.env.MPESA_ENV
);
const MPESA_CALLBACK_BASE_URL = trimTrailingSlash(
  process.env.MPESA_CALLBACK_BASE_URL
);
const MPESA_CALLBACK_URL =
  process.env.MPESA_CALLBACK_URL?.trim() ||
  (MPESA_CALLBACK_BASE_URL
    ? `${MPESA_CALLBACK_BASE_URL}/api/mpesa`
    : "https://your-domain.com/api/mpesa");
const MPESA_CALLBACK_TOKEN_TRANSPORT = normalizeCallbackTokenTransport(
  process.env.MPESA_CALLBACK_TOKEN_TRANSPORT
);

// Always required env vars
const alwaysRequired = ["DATABASE_URL", "REDIS_URL"] as const;

// Production-only required env vars (critical security)
const productionRequired = [
  "BETTER_AUTH_SECRET",
  "MPESA_CONSUMER_KEY",
  "MPESA_CONSUMER_SECRET",
  "MPESA_PASSKEY",
  "MPESA_SHORTCODE",
] as const;

// Validate always required env vars
for (const envVar of alwaysRequired) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Validate production-only required env vars
if (isProduction) {
  const missing: string[] = [];
  for (const envVar of productionRequired) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for production: ${missing.join(", ")}\n` +
        `These must be set before running in production mode.`
    );
  }
}

export const env = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL!,

  // Redis
  REDIS_URL: process.env.REDIS_URL!,

  // M-Pesa
  MPESA_CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY ?? "",
  MPESA_CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET ?? "",
  MPESA_PASSKEY: process.env.MPESA_PASSKEY ?? "",
  MPESA_SHORTCODE: process.env.MPESA_SHORTCODE ?? "",
  MPESA_ENVIRONMENT,
  MPESA_ENV: process.env.MPESA_ENV ?? "",
  MPESA_BASE_URL: process.env.MPESA_BASE_URL ?? "",
  MPESA_CALLBACK_BASE_URL,
  MPESA_CALLBACK_URL,
  MPESA_REGISTER_TOKEN: process.env.MPESA_REGISTER_TOKEN ?? "",
  MPESA_CALLBACK_TOKEN: process.env.MPESA_CALLBACK_TOKEN ?? "",
  MPESA_CALLBACK_TOKEN_TRANSPORT,
  MPESA_C2B_COMMAND_ID:
    process.env.MPESA_C2B_COMMAND_ID ?? "CustomerPayBillOnline",
  MPESA_TRANSACTION_STATUS_COMMAND_ID:
    process.env.MPESA_TRANSACTION_STATUS_COMMAND_ID ?? "TransactionStatusQuery",
  MPESA_IDENTIFIER_TYPE: Number.parseInt(
    process.env.MPESA_IDENTIFIER_TYPE ?? "4",
    10
  ),

  // Legacy/Direct Manufacturer Providers
  HEXING_API_KEY: process.env.HEXING_API_KEY ?? "",
  HEXING_API_URL: process.env.HEXING_API_URL ?? "",
  STRON_API_KEY: process.env.STRON_API_KEY ?? "",
  STRON_API_URL: process.env.STRON_API_URL ?? "",
  CONLOG_API_KEY: process.env.CONLOG_API_KEY ?? "",
  CONLOG_API_URL: process.env.CONLOG_API_URL ?? "",

  // STS Meter Provider (Gomelong)
  GOMELONG_API_URL: process.env.GOMELONG_API_URL ?? "https://sts.gomelong.top",
  GOMELONG_USER_ID: process.env.GOMELONG_USER_ID ?? "",
  GOMELONG_PASSWORD: process.env.GOMELONG_PASSWORD ?? "",
  GOMELONG_BRANDS: (process.env.GOMELONG_BRANDS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
  GOMELONG_VENDING_TYPE: Number.parseInt(
    process.env.GOMELONG_VENDING_TYPE ?? "1",
    10
  ) === 0
    ? 0
    : 1,

  // SMS Provider - Hostpinnacle
  HOSTPINNACLE_API_URL: process.env.HOSTPINNACLE_API_URL ?? "",
  HOSTPINNACLE_USER_ID: process.env.HOSTPINNACLE_USER_ID ?? "",
  HOSTPINNACLE_PASSWORD: process.env.HOSTPINNACLE_PASSWORD ?? "",
  HOSTPINNACLE_API_KEY: process.env.HOSTPINNACLE_API_KEY ?? "",
  HOSTPINNACLE_SENDER_ID: process.env.HOSTPINNACLE_SENDER_ID ?? "",

  // Application
  NODE_ENV,
  PORT: Number.parseInt(process.env.PORT ?? "3000", 10),
  CORS_ORIGINS: (process.env.CORS_ORIGINS ??
    "http://localhost:3000,http://localhost:3001,https://smartmetering.africa,https://www.smartmetering.africa")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  // Better-Auth
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "",
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

  // Business Rules
  COMMISSION_RATE: 0.1, // 10% commission
  MIN_TRANSACTION_AMOUNT: 30, // KES 30 minimum

  // Safaricom M-Pesa IP ranges for callback validation
  // Source: Safaricom Developer Documentation
  MPESA_ALLOWED_IPS: (process.env.MPESA_ALLOWED_IPS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
} as const;

export type Env = typeof env;

function normalizeMpesaEnvironment(
  value: string | undefined
): "sandbox" | "production" {
  return value?.toLowerCase() === "production" ? "production" : "sandbox";
}

function trimTrailingSlash(value: string | undefined): string {
  if (!value) return "";
  return value.trim().replace(/\/+$/g, "");
}

function normalizeCallbackTokenTransport(
  value: string | undefined
): "query" | "header" | "query_or_header" {
  const candidate = value?.toLowerCase();
  if (candidate === "query" || candidate === "header") return candidate;
  return "query_or_header";
}
