import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAllowedStaffEmail,
  normalizeKenyanPhoneNumber,
  normalizeStaffEmail,
} from "../src/lib/staff-contact";

void describe("staff contact policy", () => {
  void it("normalizes Kenyan phone numbers to 254 format", () => {
    assert.equal(normalizeKenyanPhoneNumber("0712345678"), "254712345678");
    assert.equal(normalizeKenyanPhoneNumber("254712345678"), "254712345678");
  });

  void it("rejects unsupported Kenyan phone formats", () => {
    assert.throws(() => normalizeKenyanPhoneNumber("712345678"));
    assert.throws(() => normalizeKenyanPhoneNumber("011234567"));
  });

  void it("allows only approved staff email domains", () => {
    assert.equal(normalizeStaffEmail("Agent@GMAIL.com"), "agent@gmail.com");
    assert.equal(isAllowedStaffEmail("agent@gmail.com"), true);
    assert.equal(isAllowedStaffEmail("agent@smartmetering.africa"), true);
    assert.equal(isAllowedStaffEmail("agent@example.com"), false);
  });
});
