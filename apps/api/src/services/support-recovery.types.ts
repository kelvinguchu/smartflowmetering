export interface SupportRecoverySearchCriteria {
  meterNumber?: string;
  mpesaReceiptNumber?: string;
  phoneNumber?: string;
  q?: string;
  transactionId?: string;
}

export interface SupportRecoveryMeterSummary {
  brand: string;
  id: string;
  meterNumber: string;
  meterType: string;
  motherMeter: { id: string; motherMeterNumber: string } | null;
  status: string;
  tariff: { id: string; name: string; ratePerKwh: string } | null;
}

export interface SupportRecoveryResult {
  meter: SupportRecoveryMeterSummary | null;
  recentAdminTokens: {
    createdAt: Date;
    id: string;
    maskedToken: string;
    tokenType: string;
    value: string | null;
  }[];
  recentSmsLogs: {
    createdAt: Date;
    id: string;
    messageBody: string;
    phoneNumber: string;
    provider: string;
    providerMessageId: string | null;
    status: string;
    transactionId: string | null;
  }[];
  search: SupportRecoverySearchCriteria;
  transactions: {
    amountPaid: string;
    completedAt: Date | null;
    createdAt: Date;
    generatedTokens: {
      createdAt: Date;
      id: string;
      maskedToken: string;
      tokenType: string;
      value: string | null;
    }[];
    id: string;
    meter: SupportRecoveryMeterSummary;
    mpesaReceiptNumber: string;
    netAmount: string;
    phoneNumber: string;
    smsLogs: {
      createdAt: Date;
      id: string;
      messageBody: string;
      phoneNumber: string;
      provider: string;
      providerMessageId: string | null;
      status: string;
    }[];
    status: string;
    transactionId: string;
    unitsPurchased: string;
  }[];
}
