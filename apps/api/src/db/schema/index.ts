import { relations } from "drizzle-orm";
import { tariffs } from "./tariffs";
import { customers } from "./customers";
import { properties } from "./properties";
import { motherMeters } from "./mother-meters";
import { motherMeterEvents } from "./mother-meter-events";
import { meters } from "./meters";
import { mpesaTransactions } from "./mpesa-transactions";
import { transactions } from "./transactions";
import { failedTransactions } from "./failed-transactions";
import { generatedTokens } from "./generated-tokens";
import { smsLogs } from "./sms-logs";

export {
  user,
  session,
  account,
  verification,
  twoFactor,
  userRelations,
  sessionRelations,
  accountRelations,
  twoFactorRelations,
} from "./auth";

export { tariffs, type Tariff, type NewTariff } from "./tariffs";

export {
  customers,
  customerTypeEnum,
  type Customer,
  type NewCustomer,
} from "./customers";

export { properties, type Property, type NewProperty } from "./properties";

export {
  motherMeters,
  motherMeterTypeEnum,
  type MotherMeter,
  type NewMotherMeter,
} from "./mother-meters";

export {
  motherMeterEvents,
  motherMeterEventTypeEnum,
  type MotherMeterEvent,
  type NewMotherMeterEvent,
} from "./mother-meter-events";

// Meters (Sub-meters)
export {
  meters,
  meterTypeEnum,
  meterBrandEnum,
  meterStatusEnum,
  type Meter,
  type NewMeter,
} from "./meters";

// M-Pesa Transactions (Raw callbacks)
export {
  mpesaTransactions,
  type MpesaTransaction,
  type NewMpesaTransaction,
} from "./mpesa-transactions";

// Transactions
export {
  transactions,
  transactionStatusEnum,
  paymentMethodEnum,
  type Transaction,
  type NewTransaction,
} from "./transactions";

// Failed Transactions
export {
  failedTransactions,
  failureReasonEnum,
  failedTransactionStatusEnum,
  type FailedTransaction,
  type NewFailedTransaction,
} from "./failed-transactions";

// Generated Tokens
export {
  generatedTokens,
  tokenTypeEnum,
  generatedByEnum,
  type GeneratedToken,
  type NewGeneratedToken,
} from "./generated-tokens";

// SMS Logs
export {
  smsLogs,
  smsProviderEnum,
  smsStatusEnum,
  type SmsLog,
  type NewSmsLog,
} from "./sms-logs";

// Audit Logs
export { auditLogs, type AuditLog, type NewAuditLog } from "./audit-logs";

// Meter Applications
export {
  meterApplications,
  applicationStatusEnum,
  buildingTypeEnum,
  utilityTypeEnum,
  paymentModeEnum,
  installationTypeEnum,
  billPayerEnum,
  type MeterApplication,
  type NewMeterApplication,
} from "./meter-applications";

// Tariff relations
export const tariffsRelations = relations(tariffs, ({ many }) => ({
  meters: many(meters),
  motherMeters: many(motherMeters),
}));

// Customer relations
export const customersRelations = relations(customers, ({ many }) => ({
  properties: many(properties),
  motherMeters: many(motherMeters),
}));

// Property relations
export const propertiesRelations = relations(properties, ({ one, many }) => ({
  landlord: one(customers, {
    fields: [properties.landlordId],
    references: [customers.id],
  }),
  motherMeters: many(motherMeters),
}));

// Mother Meter relations
export const motherMetersRelations = relations(
  motherMeters,
  ({ one, many }) => ({
    landlord: one(customers, {
      fields: [motherMeters.landlordId],
      references: [customers.id],
    }),
    tariff: one(tariffs, {
      fields: [motherMeters.tariffId],
      references: [tariffs.id],
    }),
    property: one(properties, {
      fields: [motherMeters.propertyId],
      references: [properties.id],
    }),
    meters: many(meters),
    events: many(motherMeterEvents),
  })
);

// Mother Meter Event relations
export const motherMeterEventsRelations = relations(
  motherMeterEvents,
  ({ one }) => ({
    motherMeter: one(motherMeters, {
      fields: [motherMeterEvents.motherMeterId],
      references: [motherMeters.id],
    }),
  })
);

// Meter relations
export const metersRelations = relations(meters, ({ one, many }) => ({
  motherMeter: one(motherMeters, {
    fields: [meters.motherMeterId],
    references: [motherMeters.id],
  }),
  tariff: one(tariffs, {
    fields: [meters.tariffId],
    references: [tariffs.id],
  }),
  transactions: many(transactions),
  generatedTokens: many(generatedTokens),
}));

// Transaction relations
export const transactionsRelations = relations(
  transactions,
  ({ one, many }) => ({
    meter: one(meters, {
      fields: [transactions.meterId],
      references: [meters.id],
    }),
    mpesaTransaction: one(mpesaTransactions, {
      fields: [transactions.mpesaTransactionId],
      references: [mpesaTransactions.id],
    }),
    generatedTokens: many(generatedTokens),
    smsLogs: many(smsLogs),
  })
);

// M-Pesa Transaction relations
export const mpesaTransactionsRelations = relations(
  mpesaTransactions,
  ({ many }) => ({
    transactions: many(transactions),
    failedTransactions: many(failedTransactions),
  })
);

// Failed Transaction relations
export const failedTransactionsRelations = relations(
  failedTransactions,
  ({ one }) => ({
    mpesaTransaction: one(mpesaTransactions, {
      fields: [failedTransactions.mpesaTransactionId],
      references: [mpesaTransactions.id],
    }),
  })
);

// Generated Token relations
export const generatedTokensRelations = relations(
  generatedTokens,
  ({ one }) => ({
    meter: one(meters, {
      fields: [generatedTokens.meterId],
      references: [meters.id],
    }),
    transaction: one(transactions, {
      fields: [generatedTokens.transactionId],
      references: [transactions.id],
    }),
  })
);

// SMS Log relations
export const smsLogsRelations = relations(smsLogs, ({ one }) => ({
  transaction: one(transactions, {
    fields: [smsLogs.transactionId],
    references: [transactions.id],
  }),
}));
