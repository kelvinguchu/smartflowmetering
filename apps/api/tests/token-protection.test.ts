import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isProtectedToken,
  protectToken,
  revealToken,
} from "../src/lib/token-protection";

describe("token protection", () => {
  it("encrypts and decrypts tokens losslessly", () => {
    const token = "12345678901234567890";
    const protectedValue = protectToken(token);

    assert.notEqual(protectedValue, token);
    assert.equal(isProtectedToken(protectedValue), true);
    assert.equal(revealToken(protectedValue), token);
  });

  it("keeps legacy plaintext tokens readable", () => {
    const token = "12345678901234567890";
    assert.equal(isProtectedToken(token), false);
    assert.equal(revealToken(token), token);
  });
});
