import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyGomelongFailure,
  createGomelongProviderError,
  formatGomelongFailureDetails,
  getGomelongFailurePolicy,
} from "../src/services/meter-providers/gomelong-failure-policy";

void describe("gomelong failure policy", () => {
  void it("marks transient provider outages as retryable", () => {
    const policy = classifyGomelongFailure({
      code: 9001,
      message: "provider unavailable",
    });

    assert.equal(policy.category, "transient_provider_failure");
    assert.equal(policy.retryable, true);
  });

  void it("marks invalid meter failures as non-retryable", () => {
    const policy = classifyGomelongFailure({
      code: 4004,
      message: "invalid meter number",
    });

    assert.equal(policy.category, "invalid_meter_or_contract");
    assert.equal(policy.retryable, false);
  });

  void it("formats operator-facing failure details with retry disposition", () => {
    const error = createGomelongProviderError({
      code: 5002,
      message: "temporary failure",
    });

    const details = formatGomelongFailureDetails(error, {
      retriesExhausted: true,
    });

    assert.match(details, /category=transient_provider_failure/);
    assert.match(details, /disposition=retryable_retries_exhausted/);
  });

  void it("preserves policy metadata on structured provider errors", () => {
    const error = createGomelongProviderError({
      message: "Gomelong credentials are not configured: GOMELONG_USER_ID",
    });

    const policy = getGomelongFailurePolicy(error);
    assert.equal(policy.category, "configuration_error");
    assert.equal(policy.retryable, false);
  });
});
