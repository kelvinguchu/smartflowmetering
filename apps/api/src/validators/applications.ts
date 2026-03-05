import { z } from "zod";

export const applicationStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);

export const createApplicationSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phoneNumber: z.string().min(10).max(20),
  email: z.string().email(),
  idNumber: z.string().min(5),
  kraPin: z.string().min(5),
  county: z.string().min(2),
  location: z.string().min(2),
  buildingType: z.enum(["residential", "commercial", "industrial"]),
  utilityType: z.enum(["electricity", "water"]),
  motherMeterNumber: z.string().min(3),
  initialReading: z.coerce.number().min(0).optional(),
  paymentMode: z.enum(["prepaid", "postpaid"]),
  subMeterNumbers: z.array(z.string().min(3)).min(1).max(200),
  installationType: z.enum(["new", "existing"]),
  suppliesOtherHouses: z.boolean().optional().default(false),
  billPayer: z.enum(["kplc", "landlord"]),
  technicianName: z.string().optional(),
  technicianPhone: z.string().optional(),
  termsAccepted: z.literal(true),
});

export const applicationQuerySchema = z.object({
  status: applicationStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const approveApplicationSchema = z.object({
  tariffId: z.string().uuid(),
  propertyName: z.string().min(1).max(120).optional(),
  motherMeterType: z.enum(["prepaid", "postpaid"]).optional(),
  meterBrand: z.enum(["hexing", "stron", "conlog"]).optional(),
  supplyGroupCode: z.string().min(3).max(32).optional(),
  keyRevisionNumber: z.coerce.number().int().min(1).max(99).optional(),
  tariffIndex: z.coerce.number().int().min(1).max(99).optional(),
  lowBalanceThreshold: z.coerce.number().positive().optional(),
});

export const rejectApplicationSchema = z.object({
  reason: z.string().min(3).max(500),
});
