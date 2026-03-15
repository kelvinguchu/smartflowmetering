export interface SupportRecoverySearchCriteria {
  meterNumber?: string;
  mpesaReceiptNumber?: string;
  phoneNumber?: string;
  q?: string;
  transactionId?: string;
}

export interface SupportRecoveryMeterSummary {
  brand: string;
  meterNumber: string;
  meterType: string;
  motherMeterNumber: string | null;
  status: string;
  tariff: { name: string; ratePerKwh: string } | null;
}

export interface SupportRecoveryResult {
  meter: SupportRecoveryMeterSummary | null;
  recentAdminTokens: {
    createdAt: Date;
    maskedToken: string;
    tokenType: string;
  }[];
  recentSmsLogs: {
    createdAt: Date;
    id: string;
    messageBody: string;
    phoneNumber: string;
    provider: string;
    status: string;
  }[];
  search: SupportRecoverySearchCriteria;
  transactions: {
    amountPaid: string;
    completedAt: Date | null;
    createdAt: Date;
    generatedTokens: {
      createdAt: Date;
      maskedToken: string;
      tokenType: string;
      value: string | null;
    }[];
    id: string;
    meter: SupportRecoveryMeterSummary;
    mpesaReceiptNumber: string;
    phoneNumber: string;
    smsLogs: {
      createdAt: Date;
      id: string;
      messageBody: string;
      provider: string;
      status: string;
    }[];
    status: string;
    transactionId: string;
    unitsPurchased: string;
  }[];
}
