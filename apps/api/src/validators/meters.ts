import { z } from "zod";

const meterStatusSchema = z.enum(["active", "inactive", "suspended"]);

export const createMeterSchema = z.object({
  meterNumber: z.string().min(6).max(20),
  meterType: z.enum(["electricity", "water", "gas"]),
  brand: z.enum(["hexing", "stron", "conlog"]),
  motherMeterId: z.uuid(),
  tariffId: z.uuid(),
  supplyGroupCode: z.string().min(1),
  keyRevisionNumber: z.number().int().min(1).max(9).optional(),
  tariffIndex: z.number().int().min(1).max(99).optional(),
});

export type CreateMeter = z.infer<typeof createMeterSchema>;

export const updateMeterSchema = z
  .object({
    tariffId: z.uuid().optional(),
    supplyGroupCode: z.string().min(1).optional(),
    keyRevisionNumber: z.number().int().min(1).max(9).optional(),
    tariffIndex: z.number().int().min(1).max(99).optional(),
    status: meterStatusSchema.optional(),
  })
  .strict();

export type UpdateMeter = z.infer<typeof updateMeterSchema>;

export const meterQuerySchema = z.object({
  meterNumber: z.string().optional(),
  status: meterStatusSchema.optional(),
  motherMeterId: z.uuid().optional(),
});

export type MeterQuery = z.infer<typeof meterQuerySchema>;
