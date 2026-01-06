// Job payload types for type safety across queues

/**
 * Payment Processing Job (Internal)
 * Triggered after transaction is logged to DB
 */
export interface PaymentProcessingJob {
  mpesaTransactionId: string;
  meterNumber: string;
  amount: string;
  phoneNumber: string;
  mpesaReceiptNumber: string;
}

/**
 * Raw M-Pesa C2B Callback Job
 * Queued immediately by the API route
 */
export interface MpesaRawCallbackJob {
  TransactionType: string;
  TransID: string;
  TransTime: string;
  TransAmount: number | string;
  BusinessShortCode: string;
  BillRefNumber: string;
  InvoiceNumber: string | null;
  OrgAccountBalance: string | null;
  ThirdPartyTransID: string | null;
  MSISDN: string;
  FirstName: string | null;
  MiddleName: string | null;
  LastName: string | null;
}

/**
 * Token Generation Job
 * Triggered after payment is validated
 */
export interface TokenGenerationJob {
  transactionId: string;
  meterId: string;
  meterNumber: string;
  brand: "hexing" | "stron" | "conlog";
  units: string;
  supplyGroupCode: string;
  keyRevisionNumber: number;
  tariffIndex: number;
}

/**
 * SMS Delivery Job
 * Triggered after token is generated
 */
export interface SmsDeliveryJob {
  transactionId: string;
  phoneNumber: string;
  meterNumber: string;
  token: string;
  units: string;
  amount: string;
}

/**
 * SMS Resend Job
 * Triggered manually by admin
 */
export interface SmsResendJob {
  smsLogId: string;
  phoneNumber: string;
  messageBody: string;
}

export type PaymentJob = PaymentProcessingJob | MpesaRawCallbackJob;
