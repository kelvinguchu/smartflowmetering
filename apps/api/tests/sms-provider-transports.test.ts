import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

describe("sendViaHostpinnacle", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("captures transactionId as providerReference when msgId is empty", async () => {
    process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
    process.env.REDIS_URL ??= "redis://localhost:6379";
    process.env.HOSTPINNACLE_API_URL = "https://smsportal.hostpinnacle.co.ke/SMSApi/send";
    process.env.HOSTPINNACLE_USER_ID = "smartflow";
    process.env.HOSTPINNACLE_PASSWORD = "secret";
    process.env.HOSTPINNACLE_API_KEY = "key";
    process.env.HOSTPINNACLE_SENDER_ID = "SMART_FLOW";

    const response = new Response(
      JSON.stringify({
        status: "success",
        transactionId: "2472728740707582315",
        msgId: "",
      }),
      { status: 200 },
    );
    mock.method(globalThis, "fetch", async () => response);

    const { sendViaHostpinnacle } = await import("../src/services/sms-provider-transports");
    const result = await sendViaHostpinnacle("254793841389", "hello");

    assert.equal(result.success, true);
    assert.equal(result.messageId, undefined);
    assert.equal(result.providerReference, "2472728740707582315");
  });
});
