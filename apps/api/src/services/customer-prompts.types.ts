export type CustomerPromptType =
  | "buy_token_nudge"
  | "failed_purchase_follow_up";

export interface CustomerPromptCandidate {
  amount: string | null;
  createdAt: Date;
  dedupeKey: string;
  meterNumber: string;
  phoneNumber: string;
  promptType: CustomerPromptType;
  referenceId: string;
}

export interface CustomerPromptSummary {
  buyTokenNudges: number;
  failedPurchaseFollowUps: number;
  total: number;
}

export interface CustomerPromptListResult {
  items: CustomerPromptCandidate[];
  summary: CustomerPromptSummary;
}

export interface CustomerPromptQueueResult extends CustomerPromptSummary {
  failed: number;
  queued: number;
  skippedDuplicate: number;
}
