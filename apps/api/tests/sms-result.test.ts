import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finalizeSmsProcessResult } from "../src/queues/processors/sms-result";

describe("finalizeSmsProcessResult", () => {
  it("keeps provider message ids when present", () => {
    const result = finalizeSmsProcessResult("abc123", "delivery");
    assert.deepEqual(result, { messageId: "abc123" });
  });

  it("does not fail successful sends with no provider message id", () => {
    const result = finalizeSmsProcessResult(undefined, "delivery");
    assert.deepEqual(result, { messageId: null });
  });
});
