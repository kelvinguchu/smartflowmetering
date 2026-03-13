import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateCommission,
  calculateNetAmount,
  calculateTransaction,
  calculateUnits,
  meetsMinimumAmount,
} from "../src/lib/money";

describe("money utilities", () => {
  it("calculates commission and net amount with fixed precision", () => {
    assert.equal(calculateCommission("100.00"), "10.00");
    assert.equal(calculateNetAmount("100.00"), "90.00");
  });

  it("calculates purchased units without float drift", () => {
    assert.equal(calculateUnits("90.00", "12.3456"), "7.2900");
  });

  it("returns a normalized transaction payload", () => {
    assert.deepEqual(calculateTransaction("100", "12.5000"), {
      grossAmount: "100.00",
      commissionAmount: "10.00",
      netAmount: "90.00",
      unitsPurchased: "7.2000",
      rateUsed: "12.5000",
    });
  });

  it("checks minimum amounts using fixed precision", () => {
    assert.equal(meetsMinimumAmount("29.99"), false);
    assert.equal(meetsMinimumAmount("30.00"), true);
  });
});
