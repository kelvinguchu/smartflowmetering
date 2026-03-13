import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { maskToken, redactTokensInText } from "../src/lib/token-redaction";

describe("token redaction", () => {
  it("masks token values except for the last four digits", () => {
    assert.equal(maskToken("12345678901234567890"), "****************7890");
  });

  it("redacts 20-digit tokens embedded in text", () => {
    assert.equal(
      redactTokensInText("Your token is 12345678901234567890 for meter X"),
      "Your token is ****************7890 for meter X"
    );
  });
});
