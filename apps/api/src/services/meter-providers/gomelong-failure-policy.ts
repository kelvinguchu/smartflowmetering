export type GomelongFailureCategory =
  | "configuration_error"
  | "invalid_meter_or_contract"
  | "missing_token_after_success"
  | "transient_provider_failure"
  | "unknown_provider_failure"
  | "unsupported_request";

export interface GomelongFailurePolicy {
  category: GomelongFailureCategory;
  operatorAction: string;
  retryable: boolean;
  summary: string;
}

export interface ParsedGomelongFailureDetails {
  category: GomelongFailureCategory | null;
  code: number | null;
  disposition:
    | "non_retryable"
    | "retryable"
    | "retryable_retries_exhausted"
    | null;
  message: string | null;
  operatorAction: string | null;
  retryable: boolean | null;
  summary: string | null;
}

export class GomelongProviderError extends Error {
  readonly code: number | null;
  readonly policy: GomelongFailurePolicy;

  constructor(input: {
    code?: number | null;
    message: string;
    policy: GomelongFailurePolicy;
  }) {
    super(input.message);
    this.name = "GomelongProviderError";
    this.code = input.code ?? null;
    this.policy = input.policy;
  }
}

export class GomelongRetriesExhaustedError extends Error {
  readonly originalError: unknown;

  constructor(error: unknown) {
    super(
      error instanceof Error ? error.message : "Gomelong retries exhausted",
    );
    this.name = "GomelongRetriesExhaustedError";
    this.originalError = error;
  }
}

export function createGomelongProviderError(input: {
  code?: number | null;
  message: string | null | undefined;
}): GomelongProviderError {
  const message = input.message?.trim() || "unknown error";

  return new GomelongProviderError({
    code: input.code ?? null,
    message,
    policy: classifyGomelongFailure({
      code: input.code ?? null,
      message,
    }),
  });
}

export function classifyGomelongFailure(input: {
  code?: number | null;
  message?: string | null;
}): GomelongFailurePolicy {
  const code = input.code ?? null;
  const message = input.message?.trim() || "unknown error";

  if (isConfigurationFailure(message)) {
    return {
      category: "configuration_error",
      operatorAction:
        "Fix Gomelong credentials or provider configuration before retrying token generation",
      retryable: false,
      summary: "Provider configuration is invalid or missing",
    };
  }

  if (isUnsupportedRequestFailure(message)) {
    return {
      category: "unsupported_request",
      operatorAction:
        "Correct the unsupported request details before retrying token generation",
      retryable: false,
      summary:
        "The request cannot succeed without changing meter type, units, or request parameters",
    };
  }

  if (isInvalidMeterOrContractFailure(code, message)) {
    return {
      category: "invalid_meter_or_contract",
      operatorAction:
        "Verify the provider-side meter contract, meter code, and activation state before retrying or refunding",
      retryable: false,
      summary:
        "Provider rejected the meter or contract details and the same request should not be retried unchanged",
    };
  }

  if (isMissingTokenAfterSuccessFailure(message)) {
    return {
      category: "missing_token_after_success",
      operatorAction:
        "Review the provider response manually before retrying or refunding because vending succeeded without a usable token payload",
      retryable: false,
      summary:
        "Provider reported success but did not return a usable STS token",
    };
  }

  if (isTransientProviderFailure(code, message)) {
    return {
      category: "transient_provider_failure",
      operatorAction:
        "Retry token generation while the outage is transient, then escalate or refund only if retries are exhausted",
      retryable: true,
      summary:
        "Provider failure looks temporary and is safe to retry with backoff",
    };
  }

  return {
    category: "unknown_provider_failure",
    operatorAction:
      "Review the provider response before retrying because the failure is not clearly classified",
    retryable: false,
    summary:
      "Provider failure could not be confidently classified as retryable",
  };
}

export function getGomelongFailurePolicy(
  error: unknown,
): GomelongFailurePolicy {
  const unwrappedError = unwrapGomelongFailure(error);

  if (unwrappedError instanceof GomelongProviderError) {
    return unwrappedError.policy;
  }

  if (unwrappedError instanceof Error) {
    return classifyGomelongFailure({ message: unwrappedError.message });
  }

  return classifyGomelongFailure({ message: "unknown error" });
}

export function formatGomelongFailureDetails(
  error: unknown,
  options?: { retriesExhausted?: boolean },
): string {
  const policy = getGomelongFailurePolicy(error);
  const unwrappedError = unwrapGomelongFailure(error);
  const code =
    unwrappedError instanceof GomelongProviderError
      ? unwrappedError.code
      : null;
  const message =
    unwrappedError instanceof Error ? unwrappedError.message : "unknown error";
  let retryState = "non_retryable";
  if (policy.retryable) {
    retryState = options?.retriesExhausted
      ? "retryable_retries_exhausted"
      : "retryable";
  }

  return [
    `Gomelong failure category=${policy.category}`,
    `disposition=${retryState}`,
    code === null ? null : `code=${code}`,
    `message=${message}`,
    `operatorAction=${policy.operatorAction}`,
  ]
    .filter((value) => value !== null)
    .join("; ");
}

export function parseGomelongFailureDetails(
  details: string | null | undefined,
): ParsedGomelongFailureDetails | null {
  if (!details?.includes("Gomelong failure")) {
    return null;
  }

  const parsed = new Map<string, string>();
  for (const part of details.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey || rawValue.length === 0) {
      continue;
    }

    parsed.set(rawKey.trim(), rawValue.join("=").trim());
  }

  const category = toFailureCategory(parsed.get("Gomelong failure category"));
  const disposition = toDisposition(parsed.get("disposition"));
  const codeValue = parsed.get("code");
  const code = codeValue === undefined ? null : Number.parseInt(codeValue, 10);

  return {
    category,
    code: Number.isFinite(code) ? code : null,
    disposition,
    message: parsed.get("message") ?? null,
    operatorAction: parsed.get("operatorAction") ?? null,
    retryable:
      disposition === null
        ? null
        : disposition === "retryable" ||
          disposition === "retryable_retries_exhausted",
    summary: category === null ? null : summarizeGomelongCategory(category),
  };
}

function isConfigurationFailure(message: string): boolean {
  return /credentials are not configured|unauthorized|forbidden|auth/i.test(
    message,
  );
}

function isUnsupportedRequestFailure(message: string): boolean {
  return /does not support meter type|invalid units|unsupported|bad request/i.test(
    message,
  );
}

function isInvalidMeterOrContractFailure(
  code: number | null,
  message: string,
): boolean {
  return (
    code === 4004 ||
    /invalid meter|meter not found|contract|meter code|meter is not active|not active/i.test(
      message,
    )
  );
}

function isMissingTokenAfterSuccessFailure(message: string): boolean {
  return /no sts token was returned|no admin token was returned/i.test(message);
}

function isTransientProviderFailure(
  code: number | null,
  message: string,
): boolean {
  return Boolean(
    code === 408 ||
    code === 429 ||
    code === 500 ||
    code === 502 ||
    code === 503 ||
    code === 504 ||
    code === 5002 ||
    code === 9001 ||
    /timeout|timed out|temporary|temporarily|unavailable|busy|gateway|econn|network|socket|http 5\d{2}/i.test(
      message,
    ),
  );
}

export function hasGomelongRetriesExhausted(error: unknown): boolean {
  return error instanceof GomelongRetriesExhaustedError;
}

export function markGomelongRetriesExhausted(
  error: unknown,
): GomelongRetriesExhaustedError {
  return new GomelongRetriesExhaustedError(error);
}

function unwrapGomelongFailure(error: unknown): unknown {
  if (error instanceof GomelongRetriesExhaustedError) {
    return error.originalError;
  }

  return error;
}

function summarizeGomelongCategory(category: GomelongFailureCategory): string {
  switch (category) {
    case "configuration_error":
      return "Provider configuration is invalid or missing";
    case "invalid_meter_or_contract":
      return "Provider rejected the meter or contract details and the same request should not be retried unchanged";
    case "missing_token_after_success":
      return "Provider reported success but did not return a usable STS token";
    case "transient_provider_failure":
      return "Provider failure looks temporary and is safe to retry with backoff";
    case "unsupported_request":
      return "The request cannot succeed without changing meter type, units, or request parameters";
    case "unknown_provider_failure":
    default:
      return "Provider failure could not be confidently classified as retryable";
  }
}

function toDisposition(
  value: string | undefined,
): ParsedGomelongFailureDetails["disposition"] {
  if (
    value === "non_retryable" ||
    value === "retryable" ||
    value === "retryable_retries_exhausted"
  ) {
    return value;
  }

  return null;
}

function toFailureCategory(
  value: string | undefined,
): GomelongFailureCategory | null {
  if (
    value === "configuration_error" ||
    value === "invalid_meter_or_contract" ||
    value === "missing_token_after_success" ||
    value === "transient_provider_failure" ||
    value === "unknown_provider_failure" ||
    value === "unsupported_request"
  ) {
    return value;
  }

  return null;
}
