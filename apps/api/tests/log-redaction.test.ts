import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  maskMeterNumberForLog,
  maskPhoneForLog,
  maskReferenceForLog,
  sanitizeUrlForLog,
} from "../src/lib/log-redaction";

describe("log redaction", () => {
  it("removes query strings from logged URLs", () => {
    assert.equal(
      sanitizeUrlForLog("https://example.com/api/mpesa/callback?token=secret"),
      "/api/mpesa/callback",
    );
  });

  it("masks phone numbers for logs", () => {
    assert.equal(maskPhoneForLog("254712345678"), "2547******78");
  });

  it("masks meter numbers for logs", () => {
    assert.equal(maskMeterNumberForLog("12345678"), "12****78");
  });

  it("masks transaction references for logs", () => {
    assert.equal(maskReferenceForLog("OHM-123456"), "OHM****456");
  });
});
