export interface SmsRecoverySummary {
  delivered: number;
  failed: number;
  pending: number;
  total: number;
}

export interface SmsRecoveryItem {
  createdAt: Date;
  id: string;
  messageBody: string;
  phoneNumber: string;
  provider: "hostpinnacle" | "textsms";
  providerErrorCode: string | null;
  providerStatus: string | null;
  retryEligible: boolean;
  status: string;
  transaction:
    | {
        meter: {
          meterNumber: string;
        };
        transactionId: string;
      }
    | null;
}

export interface SmsRecoveryListResult {
  items: SmsRecoveryItem[];
  summary: SmsRecoverySummary;
}

export interface SmsRecoverySyncResult {
  provider: "textsms";
  providerMessageId: string | null;
  smsLogId: string;
  status: "delivered" | "failed" | "sent" | null;
  synced: boolean;
}
