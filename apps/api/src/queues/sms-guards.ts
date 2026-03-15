/**
 * Pure SMS job type guards — no DB or queue imports.
 */
import type {
  SmsDlrSyncJob,
  SmsJob,
  SmsNotificationJob,
  SmsResendJob,
} from "./types";

export function isResendJob(data: SmsJob): data is SmsResendJob {
  return "kind" in data && data.kind === "resend";
}

export function isNotificationJob(data: SmsJob): data is SmsNotificationJob {
  return "kind" in data && data.kind === "notification";
}

export function isDlrSyncJob(data: SmsJob): data is SmsDlrSyncJob {
  return "kind" in data && data.kind === "dlr_sync";
}
