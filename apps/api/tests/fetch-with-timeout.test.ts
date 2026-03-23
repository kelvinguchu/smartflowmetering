import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  FetchTimeoutError,
  fetchWithTimeout,
} from "../src/lib/fetch-with-timeout";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchWithTimeout", () => {
  it("returns the fetch response before timeout", async () => {
    const response = new Response("ok", { status: 200 });
    globalThis.fetch = (async () => response) as typeof fetch;

    const result = await fetchWithTimeout("https://example.com", {
      timeoutMs: 100,
    });

    assert.equal(result.status, 200);
  });

  it("throws FetchTimeoutError when the request exceeds the timeout", async () => {
    globalThis.fetch = ((_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      })) as typeof fetch;

    await assert.rejects(
      fetchWithTimeout("https://example.com", { timeoutMs: 10 }),
      FetchTimeoutError
    );
  });
});
