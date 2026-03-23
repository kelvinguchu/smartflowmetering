import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryRateLimitStore } from "../src/lib/rate-limit-store";

describe("MemoryRateLimitStore", () => {
  it("increments within the active window", async () => {
    const store = new MemoryRateLimitStore();
    const now = Date.now();

    const first = await store.increment("auth:127.0.0.1", 60_000, now);
    const second = await store.increment("auth:127.0.0.1", 60_000, now + 1000);

    assert.equal(first.count, 1);
    assert.equal(second.count, 2);
    assert.equal(second.resetAt, first.resetAt);
  });

  it("resets the bucket after expiry", async () => {
    const store = new MemoryRateLimitStore();
    const now = Date.now();

    const first = await store.increment("auth:127.0.0.1", 1000, now);
    const reset = await store.increment("auth:127.0.0.1", 1000, now + 1500);

    assert.equal(first.count, 1);
    assert.equal(reset.count, 1);
    assert.ok(reset.resetAt > first.resetAt);
  });
});
