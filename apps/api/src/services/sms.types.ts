export type SmsProvider = "hostpinnacle" | "textsms";

export interface SmsResult {
  success: boolean;
  messageId?: string;
  cost?: string;
  error?: string;
  provider?: SmsProvider;
}
