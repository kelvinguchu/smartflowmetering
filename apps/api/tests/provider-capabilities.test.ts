import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapMeterTypeToGomelong } from "../src/services/meter-providers/provider-capabilities";

describe("provider capabilities", () => {
  it("maps supported meter types to Gomelong values", () => {
    assert.equal(mapMeterTypeToGomelong("electricity"), 1);
    assert.equal(mapMeterTypeToGomelong("water"), 2);
    assert.equal(mapMeterTypeToGomelong("gas"), null);
  });
});
