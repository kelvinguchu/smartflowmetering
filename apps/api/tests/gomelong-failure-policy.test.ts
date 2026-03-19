import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyGomelongFailure,
  createGomelongProviderError,
  formatGomelongFailureDetails,
  getGomelongFailurePolicy,
  parseGomelongFailureDetails,
} from "../src/services/meter-providers/gomelong-failure-policy";

describe("gomelong failure policy", () => {
  it("marks transient provider outages as retryable", () => {
    const policy = classifyGomelongFailure({
      code: 9001,
      message: "provider unavailable",
    });

    assert.equal(policy.category, "transient_provider_failure");
    assert.equal(policy.retryable, true);
  });

  it("marks invalid meter failures as non-retryable", () => {
    const policy = classifyGomelongFailure({
      code: 4004,
      message: "invalid meter number",
    });

    assert.equal(policy.category, "invalid_meter_or_contract");
    assert.equal(policy.retryable, false);
  });

  it("formats operator-facing failure details with retry disposition", () => {
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

  it("parses formatted failure details for operator workflows", () => {
    const error = createGomelongProviderError({
      code: 4004,
      message: "invalid meter number",
    });

    const parsed = parseGomelongFailureDetails(
      formatGomelongFailureDetails(error),
    );

    assert.deepEqual(parsed, {
      category: "invalid_meter_or_contract",
      code: 4004,
      disposition: "non_retryable",
      message: "invalid meter number",
      operatorAction:
        "Verify the provider-side meter contract, meter code, and activation state before retrying or refunding",
      retryable: false,
      summary:
        "Provider rejected the meter or contract details and the same request should not be retried unchanged",
    });
  });

  it("preserves policy metadata on structured provider errors", () => {
    const error = createGomelongProviderError({
      message: "Gomelong credentials are not configured: GOMELONG_USER_ID",
    });

    const policy = getGomelongFailurePolicy(error);
    assert.equal(policy.category, "configuration_error");
    assert.equal(policy.retryable, false);
  });
});
