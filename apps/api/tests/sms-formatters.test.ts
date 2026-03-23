import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatAdminTokenSms } from "../src/lib/sms-formatters";

describe("formatAdminTokenSms", () => {
  it("formats admin clear tamper SMS content with grouped token", () => {
    const message = formatAdminTokenSms({
      meterNumber: "12345678",
      token: "12345678901234567890",
      tokenType: "clear_tamper",
    });

    assert.match(message, /Action:Clear Tamper/);
    assert.match(message, /Token:1234-5678-9012-3456-7890/);
  });

  it("formats power limit SMS content with the target wattage", () => {
    const message = formatAdminTokenSms({
      meterNumber: "12345678",
      token: "12345678901234567890",
      tokenType: "set_power_limit",
      power: 5000,
    });

    assert.match(message, /Action:Set Power 5000W/);
  });
});
