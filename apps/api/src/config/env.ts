// Environment configuration with runtime validation
// All env vars are validated at startup

// Node environment
const NODE_ENV = (process.env.NODE_ENV ?? "development") as
  | "development"
  | "production"
  | "test";

const isProduction = NODE_ENV === "production";

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
  MPESA_ENVIRONMENT: (process.env.MPESA_ENVIRONMENT ?? "sandbox") as
    | "sandbox"
    | "production",
  MPESA_CALLBACK_URL:
    process.env.MPESA_CALLBACK_URL ?? "https://your-domain.com/api/mpesa",

  // Manufacturer API Keys
  HEXING_API_KEY: process.env.HEXING_API_KEY ?? "",
  HEXING_API_URL: process.env.HEXING_API_URL ?? "",
  STRON_API_KEY: process.env.STRON_API_KEY ?? "",
  STRON_API_URL: process.env.STRON_API_URL ?? "",
  CONLOG_API_KEY: process.env.CONLOG_API_KEY ?? "",
  CONLOG_API_URL: process.env.CONLOG_API_URL ?? "",

  // SMS Providers - Africa's Talking
  AFRICASTALKING_ENVIRONMENT: (process.env.AFRICASTALKING_ENVIRONMENT ?? "sandbox") as
    | "sandbox"
    | "live",
  AFRICASTALKING_API_KEY: process.env.AFRICASTALKING_API_KEY ?? "",
  AFRICASTALKING_SANDBOX_API_KEY: process.env.AFRICASTALKING_SANDBOX_API_KEY ?? "",
  AFRICASTALKING_USERNAME: process.env.AFRICASTALKING_USERNAME ?? "",
  AFRICASTALKING_SENDER_ID: process.env.AFRICASTALKING_SENDER_ID ?? "",

  // SMS Providers - Hostpinnacle (fallback)
  HOSTPINNACLE_API_KEY: process.env.HOSTPINNACLE_API_KEY ?? "",
  HOSTPINNACLE_SENDER_ID: process.env.HOSTPINNACLE_SENDER_ID ?? "",

  // Application
  NODE_ENV,
  PORT: Number.parseInt(process.env.PORT ?? "3000", 10),

  // Better-Auth
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "",
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

  // Business Rules
  COMMISSION_RATE: 0.1, // 10% commission
  MIN_TRANSACTION_AMOUNT: 30, // KES 30 minimum

  // Safaricom M-Pesa IP ranges for callback validation
  // Source: Safaricom Developer Documentation
  MPESA_ALLOWED_IPS: (process.env.MPESA_ALLOWED_IPS ?? "").split(",").filter(Boolean),
} as const;

export type Env = typeof env;
