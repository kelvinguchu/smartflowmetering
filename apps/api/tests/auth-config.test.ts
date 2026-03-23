import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldDisablePublicSignUp } from "../src/lib/auth-config";

describe("shouldDisablePublicSignUp", () => {
  it("disables self-service sign-up outside tests", () => {
    assert.equal(shouldDisablePublicSignUp("production"), true);
    assert.equal(shouldDisablePublicSignUp("development"), true);
  });

  it("keeps sign-up available for automated tests", () => {
    assert.equal(shouldDisablePublicSignUp("test"), false);
  });
});
