import {
  pgTable,
  uuid,
  text,
  numeric,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

// Application status enum
export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "approved",
  "rejected",
]);

// Building type enum
export const buildingTypeEnum = pgEnum("building_type", [
  "residential",
  "commercial",
  "industrial",
]);

// Utility type enum
export const utilityTypeEnum = pgEnum("utility_type", ["electricity", "water"]);

// Payment mode enum
export const paymentModeEnum = pgEnum("payment_mode", ["prepaid", "postpaid"]);

// Installation type enum
export const installationTypeEnum = pgEnum("installation_type", [
  "new",
  "existing",
]);

// Bill payer enum
export const billPayerEnum = pgEnum("bill_payer", ["kplc", "landlord"]);

export const meterApplications = pgTable("meter_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: applicationStatusEnum("status").notNull().default("pending"),

  // Personal Details
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  email: text("email").notNull(),
  idNumber: text("id_number").notNull(),
  kraPin: text("kra_pin").notNull(),

  // Location Details
  county: text("county").notNull(),
  location: text("location").notNull(),

  // Property Details
  buildingType: buildingTypeEnum("building_type").notNull(),
  utilityType: utilityTypeEnum("utility_type").notNull(),
  motherMeterNumber: text("mother_meter_number").notNull(),
  initialReading: numeric("initial_reading", { precision: 12, scale: 2 }),
  paymentMode: paymentModeEnum("payment_mode").notNull(),
  subMeterNumbers: jsonb("sub_meter_numbers").notNull(), // Array of meter numbers

  // Installation Details
  installationType: installationTypeEnum("installation_type").notNull(),
  suppliesOtherHouses: boolean("supplies_other_houses")
    .notNull()
    .default(false),
  billPayer: billPayerEnum("bill_payer").notNull(),

  // Technician Details
  technicianName: text("technician_name"),
  technicianPhone: text("technician_phone"),

  // Terms
  termsAccepted: boolean("terms_accepted").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Types
export type MeterApplication = typeof meterApplications.$inferSelect;
export type NewMeterApplication = typeof meterApplications.$inferInsert;
