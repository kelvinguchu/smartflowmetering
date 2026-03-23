import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAdminTokenSchema } from "../src/validators/admin-tokens";

describe("createAdminTokenSchema", () => {
  it("requires power for set_power_limit", () => {
    const result = createAdminTokenSchema.safeParse({
      meterNumber: "12345678",
      action: "set_power_limit",
      reason: "Support-requested power adjustment",
      delivery: "none",
    });

    assert.equal(result.success, false);
  });

  it("requires sgcId for key_change", () => {
    const result = createAdminTokenSchema.safeParse({
      meterNumber: "12345678",
      action: "key_change",
      reason: "Customer meter key rotation request",
      delivery: "none",
    });

    assert.equal(result.success, false);
  });

  it("requires phoneNumber when delivery is sms", () => {
    const result = createAdminTokenSchema.safeParse({
      meterNumber: "12345678",
      action: "clear_tamper",
      reason: "Tamper cleared after field verification",
      delivery: "sms",
    });

    assert.equal(result.success, false);
  });

  it("accepts a valid clear_tamper request", () => {
    const result = createAdminTokenSchema.safeParse({
      meterNumber: "12345678",
      action: "clear_tamper",
      reason: "Tamper cleared after field verification",
      delivery: "sms",
      phoneNumber: "254712345678",
    });

    assert.equal(result.success, true);
  });
});
