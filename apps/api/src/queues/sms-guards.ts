/**
 * Pure SMS job type guards — no DB or queue imports.
 */
import type { SmsJob, SmsNotificationJob, SmsResendJob } from "./types";

export function isResendJob(data: SmsJob): data is SmsResendJob {
  return "kind" in data && data.kind === "resend";
}

export function isNotificationJob(data: SmsJob): data is SmsNotificationJob {
  return "kind" in data && data.kind === "notification";
}
