export interface SmsRecoverySummary {
  delivered: number;
  failed: number;
  pending: number;
  total: number;
}

export interface SmsRecoveryItem {
  cost: string | null;
  createdAt: Date;
  id: string;
  messageBody: string;
  phoneNumber: string;
  providerErrorCode: string | null;
  providerMessageId: string | null;
  providerStatus: string | null;
  retryEligible: boolean;
  status: string;
  transaction:
    | {
        id: string;
        meter: {
          id: string;
          meterNumber: string;
        };
        transactionId: string;
      }
    | null;
  updatedAt: Date;
}

export interface SmsRecoveryListResult {
  items: SmsRecoveryItem[];
  summary: SmsRecoverySummary;
}
