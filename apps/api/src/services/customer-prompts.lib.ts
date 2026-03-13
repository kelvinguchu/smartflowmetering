import { formatCustomerPromptContent } from "../lib/customer-prompt-formatters";
import { normalizeKenyanPhoneNumber } from "../lib/staff-contact";
import type { CustomerPromptListQuery } from "../validators/customer-prompts";
import type {
  CustomerPromptCandidate,
  CustomerPromptSummary,
  CustomerPromptType,
} from "./customer-prompts.types";

export function buildPromptContent(candidate: CustomerPromptCandidate) {
  return formatCustomerPromptContent(candidate);
}

export function shouldIncludePromptType(
  selectedType: CustomerPromptListQuery["type"],
  promptType: CustomerPromptType,
): boolean {
  return selectedType === "all" || selectedType === promptType;
}

export function summarizePromptCandidates(
  candidates: CustomerPromptCandidate[],
): CustomerPromptSummary {
  return {
    buyTokenNudges: candidates.filter((item) => item.promptType === "buy_token_nudge").length,
    failedPurchaseFollowUps: candidates.filter(
      (item) => item.promptType === "failed_purchase_follow_up",
    ).length,
    total: candidates.length,
  };
}

export function uniqueNormalizedValues(values: string[]): string[] {
  return [...new Set(values.map((value) => normalizeKenyanPhoneNumberOrKeep(value)))];
}

function normalizeKenyanPhoneNumberOrKeep(value: string): string {
  try {
    return normalizeKenyanPhoneNumber(value);
  } catch {
    return value;
  }
}
