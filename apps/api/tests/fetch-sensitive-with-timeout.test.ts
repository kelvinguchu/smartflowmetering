import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { fetchSensitiveWithTimeout } from "../src/lib/fetch-sensitive-with-timeout";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchSensitiveWithTimeout", () => {
  it("forces redirect rejection and no-store caching", async () => {
    let requestInit: RequestInit | undefined;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestInit = init;
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    await fetchSensitiveWithTimeout("https://example.com", {
      method: "POST",
      timeoutMs: 100,
    });

    assert.equal(requestInit?.redirect, "error");
    assert.equal(requestInit?.cache, "no-store");
    assert.equal(requestInit?.referrerPolicy, "no-referrer");
  });
});
