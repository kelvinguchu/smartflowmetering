import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { SmsResult } from "../src/services/sms/sms.types";

const originalFetch = globalThis.fetch;
const envKeys = [
  "DATABASE_URL",
  "REDIS_URL",
  "ALERT_TIMEZONE",
  "HOSTPINNACLE_API_URL",
  "HOSTPINNACLE_USER_ID",
  "HOSTPINNACLE_PASSWORD",
  "HOSTPINNACLE_API_KEY",
  "HOSTPINNACLE_SENDER_ID",
  "TEXTSMS_API_URL",
  "TEXTSMS_PARTNER_ID",
  "TEXTSMS_API_KEY",
  "TEXTSMS_SENDER_ID",
  "TEXTSMS_PASS_TYPE",
] as const;

const originalEnv = new Map<string, string | undefined>(
  envKeys.map((key) => [key, process.env[key]]),
);

function applySmsTestEnv() {
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@localhost:5432/smartflowmetering";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.ALERT_TIMEZONE = "Africa/Nairobi";
  process.env.HOSTPINNACLE_API_URL = "https://host.example/send";
  process.env.HOSTPINNACLE_USER_ID = "host-user";
  process.env.HOSTPINNACLE_PASSWORD = "host-pass";
  process.env.HOSTPINNACLE_API_KEY = "host-key";
  process.env.HOSTPINNACLE_SENDER_ID = "HOST";
  process.env.TEXTSMS_API_URL = "https://textsms.example/send";
  process.env.TEXTSMS_PARTNER_ID = "partner-1";
  process.env.TEXTSMS_API_KEY = "text-key";
  process.env.TEXTSMS_SENDER_ID = "TEXTSMS";
  process.env.TEXTSMS_PASS_TYPE = "plain";
}

async function loadSmsModule() {
  const moduleUrl = new URL(
    `../src/services/sms/sms.service.ts?cacheBust=${Date.now()}-${Math.random()}`,
    import.meta.url,
  );
  return import(moduleUrl.href) as Promise<{
    sendSms: (phoneNumber: string, message: string) => Promise<SmsResult>;
  }>;
}

function requestTarget(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input.url;
}

function restoreEnv() {
  process.env.DATABASE_URL = originalEnv.get("DATABASE_URL");
  process.env.REDIS_URL = originalEnv.get("REDIS_URL");
  process.env.ALERT_TIMEZONE = originalEnv.get("ALERT_TIMEZONE");
  process.env.HOSTPINNACLE_API_URL = originalEnv.get("HOSTPINNACLE_API_URL");
  process.env.HOSTPINNACLE_USER_ID = originalEnv.get("HOSTPINNACLE_USER_ID");
  process.env.HOSTPINNACLE_PASSWORD = originalEnv.get("HOSTPINNACLE_PASSWORD");
  process.env.HOSTPINNACLE_API_KEY = originalEnv.get("HOSTPINNACLE_API_KEY");
  process.env.HOSTPINNACLE_SENDER_ID = originalEnv.get("HOSTPINNACLE_SENDER_ID");
  process.env.TEXTSMS_API_URL = originalEnv.get("TEXTSMS_API_URL");
  process.env.TEXTSMS_PARTNER_ID = originalEnv.get("TEXTSMS_PARTNER_ID");
  process.env.TEXTSMS_API_KEY = originalEnv.get("TEXTSMS_API_KEY");
  process.env.TEXTSMS_SENDER_ID = originalEnv.get("TEXTSMS_SENDER_ID");
  process.env.TEXTSMS_PASS_TYPE = originalEnv.get("TEXTSMS_PASS_TYPE");
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv();
});

void describe("sendSms fallback order", () => {
  void it("uses HostPinnacle first and does not touch TextSMS when HostPinnacle succeeds", async () => {
    applySmsTestEnv();
    const calls: string[] = [];

    globalThis.fetch = ((input: RequestInfo | URL) => {
      calls.push(requestTarget(input));

      return Promise.resolve(
        new Response(JSON.stringify({ msgid: "HP-1", status: "success" }), {
          status: 200,
        }),
      );
    }) as typeof fetch;

    const { sendSms } = await loadSmsModule();
    const result = await sendSms("0712345678", "Hello");

    assert.equal(result.success, true);
    assert.equal(result.provider, "hostpinnacle");
    assert.deepEqual(calls, ["https://host.example/send"]);
  });

  void it("falls back to TextSMS only after HostPinnacle fails", async () => {
    applySmsTestEnv();
    const calls: string[] = [];

    globalThis.fetch = ((input: RequestInfo | URL) => {
      calls.push(requestTarget(input));

      if (calls.length === 1) {
        return Promise.resolve(
          new Response(JSON.stringify({ message: "Invalid credentials" }), {
            status: 401,
          }),
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            responses: [
              {
                "respose-code": 200,
                "response-description": "Success",
                messageid: 8290842,
              },
            ],
          }),
          { status: 200 },
        ),
      );
    }) as typeof fetch;

    const { sendSms } = await loadSmsModule();
    const result = await sendSms("0712345678", "Hello");

    assert.equal(result.success, true);
    assert.equal(result.provider, "textsms");
    assert.deepEqual(calls, [
      "https://host.example/send",
      "https://textsms.example/send",
    ]);
  });
});


