import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import dotenv from "dotenv";

interface CliOptions {
  envFile: string;
  message: string;
  phoneNumber: string;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  loadEnvFile(options.envFile);

  void sendTestSms(options)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(message);
      process.exitCode = 1;
    });
}

function parseArgs(args: string[]): CliOptions {
  const values = new Map<string, string>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    values.set(key, value);
    index += 1;
  }

  const phoneNumber = values.get("phone");
  const message = values.get("message");
  if (!phoneNumber || !message) {
    throw new Error(
      "Usage: bunx tsx scripts/test-sms-provider.ts --phone 2547... --message \"...\" [--env-file ../../.env]",
    );
  }

  return {
    envFile: values.get("env-file") ?? resolve(process.cwd(), "..", "..", ".env"),
    message,
    phoneNumber,
  };
}

function loadEnvFile(envFile: string) {
  const resolvedPath = resolve(envFile);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Env file not found: ${resolvedPath}`);
  }

  dotenv.config({ path: resolvedPath, override: true });
}

async function sendTestSms(options: CliOptions) {
  return sendViaHostpinnacle(options.phoneNumber, options.message);
}

async function sendViaHostpinnacle(phoneNumber: string, message: string) {
  const requiredVars = [
    "HOSTPINNACLE_API_URL",
    "HOSTPINNACLE_USER_ID",
    "HOSTPINNACLE_PASSWORD",
    "HOSTPINNACLE_API_KEY",
    "HOSTPINNACLE_SENDER_ID",
  ] as const;
  assertRequiredEnv(requiredVars);

  const payload = new URLSearchParams({
    userid: process.env.HOSTPINNACLE_USER_ID!,
    password: process.env.HOSTPINNACLE_PASSWORD!,
    senderid: process.env.HOSTPINNACLE_SENDER_ID!,
    mobile: normalizePhoneNumber(phoneNumber),
    msg: message,
    msgType: "text",
    duplicatecheck: "true",
    output: "json",
    sendMethod: "quick",
  });
  appendOptionalPayloadValue(
    payload,
    "dltEntityId",
    process.env.HOSTPINNACLE_DLT_ENTITY_ID,
  );
  appendOptionalPayloadValue(
    payload,
    "dltTemplateId",
    process.env.HOSTPINNACLE_DLT_TEMPLATE_ID,
  );

  const requestPreview = {
    body: maskFormPayload(payload),
    headers: {
      apikey: maskSecret(process.env.HOSTPINNACLE_API_KEY!),
      "cache-control": "no-cache",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
    url: process.env.HOSTPINNACLE_API_URL!,
  };

  const response = await fetch(process.env.HOSTPINNACLE_API_URL!, {
    method: "POST",
    headers: {
      apikey: process.env.HOSTPINNACLE_API_KEY!,
      "cache-control": "no-cache",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload,
  });

  const rawBody = await response.text();
  return {
    httpStatus: response.status,
    provider: "hostpinnacle",
    rawBody,
    requestPreview,
  };
}

function appendOptionalPayloadValue(
  payload: URLSearchParams,
  key: string,
  value: string | undefined,
) {
  if (value && value.trim()) {
    payload.set(key, value.trim());
  }
}

function assertRequiredEnv(envVars: readonly string[]) {
  const missing = envVars.filter((envVar) => !process.env[envVar]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

function maskFormPayload(payload: URLSearchParams) {
  return Object.fromEntries(
    [...payload.entries()].map(([key, value]) => [
      key,
      shouldMaskField(key) ? maskSecret(value) : value,
    ]),
  );
}

function shouldMaskField(key: string) {
  return key === "userid" || key === "password" || key === "apikey";
}

function maskSecret(value: string) {
  if (value.length <= 4) {
    return "*".repeat(value.length);
  }

  return `${value.slice(0, 2)}${"*".repeat(Math.max(value.length - 4, 1))}${value.slice(-2)}`;
}

function normalizePhoneNumber(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }

  throw new Error(`Unsupported phone number format: ${phoneNumber}`);
}

main();
