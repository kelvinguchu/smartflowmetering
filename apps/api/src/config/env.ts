// Environment configuration with runtime validation
// All env vars are validated at startup
import { normalizeCallbackTokenTransport } from "./mpesa-config";

// Node environment
const NODE_ENV = (process.env.NODE_ENV ?? "development") as
  | "development"
  | "production"
  | "test";

const isProduction = NODE_ENV === "production";
const MPESA_ENVIRONMENT = normalizeMpesaEnvironment(
  process.env.MPESA_ENVIRONMENT,
);
const MPESA_CALLBACK_URL =
  process.env.MPESA_CALLBACK_URL?.trim() ?? "https://your-domain.com/api/mpesa";
const DATABASE_URL = process.env.DATABASE_URL ?? "";
const REDIS_URL = process.env.REDIS_URL ?? "";
const FIREBASE_SERVICE_ACCOUNT_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ??
  "./smart-flow-metering-firebase-adminsdk-fbsvc-f853c036bd.json";
const TEXTSMS_PASS_TYPE = process.env.TEXTSMS_PASS_TYPE?.trim();
const MPESA_CALLBACK_TOKEN_TRANSPORT = normalizeCallbackTokenTransport(
  process.env.MPESA_CALLBACK_TOKEN_TRANSPORT,
);
const GOMELONG_API_URL = normalizeGomelongApiUrl(
  process.env.GOMELONG_API_URL ?? "https://sts.gomelong.top",
);
const GOMELONG_ALLOW_QUERY_CREDENTIALS = parseBoolean(
  process.env.GOMELONG_ALLOW_QUERY_CREDENTIALS,
  !isProduction,
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
        `These must be set before running in production mode.`,
    );
  }
}

export const env = {
  // Database
  DATABASE_URL,

  // Redis
  REDIS_URL,

  // M-Pesa
  MPESA_CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY ?? "",
  MPESA_CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET ?? "",
  MPESA_PASSKEY: process.env.MPESA_PASSKEY ?? "",
  MPESA_SHORTCODE: process.env.MPESA_SHORTCODE ?? "",
  MPESA_ENVIRONMENT,
  MPESA_BASE_URL: process.env.MPESA_BASE_URL ?? "",
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
    10,
  ),
  MPESA_SIGNATURE_SECRET: process.env.MPESA_SIGNATURE_SECRET ?? "",
  MPESA_SIGNATURE_HEADER: (
    process.env.MPESA_SIGNATURE_HEADER ?? "x-mpesa-signature"
  )
    .trim()
    .toLowerCase(),
  MPESA_SIGNATURE_TIMESTAMP_HEADER: (
    process.env.MPESA_SIGNATURE_TIMESTAMP_HEADER ?? "x-mpesa-timestamp"
  )
    .trim()
    .toLowerCase(),
  MPESA_SIGNATURE_MAX_AGE_SECONDS: parsePositiveInteger(
    process.env.MPESA_SIGNATURE_MAX_AGE_SECONDS,
    300,
  ),
  MPESA_REQUIRE_SIGNATURE: parseBoolean(
    process.env.MPESA_REQUIRE_SIGNATURE,
    isProduction && Boolean(process.env.MPESA_SIGNATURE_SECRET),
  ),

  // STS Meter Provider (Gomelong)
  GOMELONG_API_URL,
  GOMELONG_ALLOW_QUERY_CREDENTIALS,
  GOMELONG_USER_ID: process.env.GOMELONG_USER_ID ?? "",
  GOMELONG_PASSWORD: process.env.GOMELONG_PASSWORD ?? "",
  GOMELONG_VENDING_TYPE:
    Number.parseInt(process.env.GOMELONG_VENDING_TYPE ?? "1", 10) === 0 ? 0 : 1,

  // SMS Provider - Hostpinnacle
  HOSTPINNACLE_API_URL: process.env.HOSTPINNACLE_API_URL ?? "",
  HOSTPINNACLE_USER_ID: process.env.HOSTPINNACLE_USER_ID ?? "",
  HOSTPINNACLE_PASSWORD: process.env.HOSTPINNACLE_PASSWORD ?? "",
  HOSTPINNACLE_API_KEY: process.env.HOSTPINNACLE_API_KEY ?? "",
  HOSTPINNACLE_SENDER_ID: process.env.HOSTPINNACLE_SENDER_ID ?? "",
  HOSTPINNACLE_DLR_WEBHOOK_TOKEN:
    process.env.HOSTPINNACLE_DLR_WEBHOOK_TOKEN ?? "",
  HOSTPINNACLE_DLR_WEBHOOK_HEADER: (
    process.env.HOSTPINNACLE_DLR_WEBHOOK_HEADER ??
    "x-hostpinnacle-webhook-token"
  )
    .trim()
    .toLowerCase(),
  TEXTSMS_API_URL: process.env.TEXTSMS_API_URL ?? "",
  TEXTSMS_BULK_API_URL: process.env.TEXTSMS_BULK_API_URL ?? "",
  TEXTSMS_DLR_API_URL: process.env.TEXTSMS_DLR_API_URL ?? "",
  TEXTSMS_BALANCE_API_URL: process.env.TEXTSMS_BALANCE_API_URL ?? "",
  TEXTSMS_PARTNER_ID: process.env.TEXTSMS_PARTNER_ID ?? "",
  TEXTSMS_API_KEY: process.env.TEXTSMS_API_KEY ?? "",
  TEXTSMS_SENDER_ID: process.env.TEXTSMS_SENDER_ID ?? "",
  TEXTSMS_PASS_TYPE:
    TEXTSMS_PASS_TYPE === undefined || TEXTSMS_PASS_TYPE === ""
      ? "plain"
      : TEXTSMS_PASS_TYPE,

  // Application
  NODE_ENV,
  PORT: Number.parseInt(process.env.PORT ?? "3000", 10),
  CORS_ORIGINS: (
    process.env.CORS_ORIGINS ??
    "http://localhost:3000,http://localhost:3001,https://smartmetering.africa,https://www.smartmetering.africa"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  // Better-Auth
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "",
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

  // Firebase / FCM
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? "",
  FIREBASE_SERVICE_ACCOUNT_PATH,
  FCM_ENABLED: parseBoolean(
    process.env.FCM_ENABLED,
    Boolean(FIREBASE_SERVICE_ACCOUNT_PATH),
  ),
  FCM_DRY_RUN: parseBoolean(process.env.FCM_DRY_RUN, false),

  // Business Rules
  COMMISSION_RATE: 0.1, // 10% commission
  MIN_TRANSACTION_AMOUNT: 30, // KES 30 minimum
  ALERT_AUTOMATION_ENABLED: parseBoolean(
    process.env.ALERT_AUTOMATION_ENABLED,
    false,
  ),
  ALERT_AUTOMATION_INTERVAL_SECONDS: parsePositiveInteger(
    process.env.ALERT_AUTOMATION_INTERVAL_SECONDS,
    900,
  ),
  ALERT_TIMEZONE: process.env.ALERT_TIMEZONE?.trim() ?? "Africa/Nairobi",
  LOW_BALANCE_ALERT_DEDUPE_HOURS: parsePositiveInteger(
    process.env.LOW_BALANCE_ALERT_DEDUPE_HOURS,
    12,
  ),
  POSTPAID_REMINDER_DEDUPE_HOURS: parsePositiveInteger(
    process.env.POSTPAID_REMINDER_DEDUPE_HOURS,
    24,
  ),
  POSTPAID_REMINDER_DAYS_AFTER_PAYMENT: parsePositiveInteger(
    process.env.POSTPAID_REMINDER_DAYS_AFTER_PAYMENT,
    13,
  ),
  SMS_PROVIDER_ALERT_AUTOMATION_ENABLED: parseBoolean(
    process.env.SMS_PROVIDER_ALERT_AUTOMATION_ENABLED,
    false,
  ),
  LANDLORD_DAILY_USAGE_SMS_ENABLED: parseBoolean(
    process.env.LANDLORD_DAILY_USAGE_SMS_ENABLED,
    isProduction,
  ),
  LANDLORD_DAILY_USAGE_SMS_HOUR: parseHour(
    process.env.LANDLORD_DAILY_USAGE_SMS_HOUR,
    20,
  ),
  CUSTOMER_PROMPTS_ENABLED: parseBoolean(
    process.env.CUSTOMER_PROMPTS_ENABLED,
    false,
  ),
  CUSTOMER_PROMPTS_MAX_PER_RUN: parsePositiveInteger(
    process.env.CUSTOMER_PROMPTS_MAX_PER_RUN,
    25,
  ),
  FAILED_PURCHASE_PROMPT_DEDUPE_HOURS: parsePositiveInteger(
    process.env.FAILED_PURCHASE_PROMPT_DEDUPE_HOURS,
    24,
  ),
  BUY_TOKEN_NUDGE_STALE_DAYS: parsePositiveInteger(
    process.env.BUY_TOKEN_NUDGE_STALE_DAYS,
    7,
  ),
  BUY_TOKEN_NUDGE_DEDUPE_HOURS: parsePositiveInteger(
    process.env.BUY_TOKEN_NUDGE_DEDUPE_HOURS,
    24,
  ),

  // Safaricom M-Pesa IP ranges for callback validation
  // Source: Safaricom Developer Documentation
  MPESA_ALLOWED_IPS: (process.env.MPESA_ALLOWED_IPS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
} as const;

export type Env = typeof env;

if (
  isProduction &&
  !GOMELONG_ALLOW_QUERY_CREDENTIALS &&
  process.env.GOMELONG_USER_ID &&
  process.env.GOMELONG_PASSWORD &&
  !isLocalDevelopmentHost(new URL(GOMELONG_API_URL).hostname)
) {
  throw new Error(
    "Gomelong query-string credential transport is disabled by default in production. Set GOMELONG_ALLOW_QUERY_CREDENTIALS=true only if you explicitly accept the upstream provider risk.",
  );
}

function normalizeMpesaEnvironment(
  value: string | undefined,
): "sandbox" | "production" {
  return value?.toLowerCase() === "production" ? "production" : "sandbox";
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }
  return fallback;
}

function parseHour(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed < 0 || parsed > 23) {
    return fallback;
  }
  return parsed;
}

function normalizeGomelongApiUrl(value: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("GOMELONG_API_URL must be a valid absolute URL");
  }

  if (parsed.username || parsed.password) {
    throw new Error("GOMELONG_API_URL must not embed credentials in the URL");
  }

  if (
    parsed.protocol !== "https:" &&
    !isLocalDevelopmentHost(parsed.hostname)
  ) {
    throw new Error(
      "GOMELONG_API_URL must use HTTPS unless it targets localhost or 127.0.0.1 for local testing",
    );
  }

  return parsed.toString();
}

function isLocalDevelopmentHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}
