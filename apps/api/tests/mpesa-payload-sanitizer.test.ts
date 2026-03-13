import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeMpesaPayload } from "../src/lib/mpesa-payload-sanitizer";

describe("sanitizeMpesaPayload", () => {
  it("redacts phone numbers and names in nested payloads", () => {
    const sanitized = sanitizeMpesaPayload({
      MSISDN: "254712345678",
      FirstName: "Jane",
      CallbackMetadata: {
        Item: [
          { Name: "PhoneNumber", Value: 254712345678 },
          { Name: "Amount", Value: 150 },
        ],
      },
    }) as {
      MSISDN: string;
      FirstName: string;
      CallbackMetadata: { Item: Array<{ Name: string; Value: string | number }> };
    };

    assert.equal(sanitized.MSISDN, "********5678");
    assert.equal(sanitized.FirstName, "[redacted]");
    assert.equal(sanitized.CallbackMetadata.Item[0]?.Value, "********5678");
    assert.equal(sanitized.CallbackMetadata.Item[1]?.Value, 150);
  });
});
