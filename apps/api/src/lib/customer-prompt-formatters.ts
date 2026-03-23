import type { CustomerPromptCandidate } from "../services/customer/customer-prompts.types";

export function formatCustomerPromptContent(candidate: CustomerPromptCandidate) {
  if (candidate.promptType === "failed_purchase_follow_up") {
    return {
      message: `We could not complete your token purchase for meter ${candidate.meterNumber}. Please try again or contact support if you need help.`,
      title: "Purchase needs attention",
    };
  }

  return {
    message: `Meter ${candidate.meterNumber} has no recent token purchase. Buy tokens early to avoid interruption.`,
    title: "Buy token reminder",
  };
}

