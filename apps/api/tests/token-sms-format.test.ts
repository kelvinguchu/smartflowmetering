import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatTokenSms } from "../src/services/sms.service";

describe("formatTokenSms", () => {
  it("formats the token SMS exactly as the vending slip layout", () => {
    const message = formatTokenSms({
      meterNumber: "37208250748",
      token: "51364478789055955459",
      transactionDate: new Date("2025-10-20T15:40:00.000Z"),
      units: "14.3000",
      amountPaid: "300",
      tokenAmount: "173.13",
      otherCharges: "126.87",
    });

    assert.equal(
      message,
      [
        "Mtr:37208250748",
        "Token:5136-4478-7890-5595-5459",
        "Date:20251020 18:40",
        "Units:14.3",
        "Amt:300.00",
        "TknAmt:173.13",
        "OtherCharges:126.87",
      ].join("\n"),
    );
  });
});
