import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeCallbackTokenTransport } from "../src/config/mpesa-config";

describe("normalizeCallbackTokenTransport", () => {
  it("defaults to header transport when unset or invalid", () => {
    assert.equal(normalizeCallbackTokenTransport(undefined), "header");
    assert.equal(normalizeCallbackTokenTransport("invalid"), "header");
  });

  it("preserves explicitly configured transport modes", () => {
    assert.equal(normalizeCallbackTokenTransport("header"), "header");
    assert.equal(normalizeCallbackTokenTransport("query"), "query");
    assert.equal(
      normalizeCallbackTokenTransport("query_or_header"),
      "query_or_header"
    );
  });
});
