import { z } from "zod";
import type {
  GomelongMeterType,
  GomelongVendingType,
} from "../services/meter-providers/gomelong-client";

export const meterTypeSchema = z
  .union([z.literal(1), z.literal(2), z.literal("1"), z.literal("2")])
  .transform(
    (value): GomelongMeterType => (value === 1 || value === "1" ? 1 : 2),
  );

export const vendingTypeSchema = z
  .union([z.literal(0), z.literal(1), z.literal("0"), z.literal("1")])
  .transform(
    (value): GomelongVendingType => (value === 0 || value === "0" ? 0 : 1),
  );

export const meterCodeSchema = z.string().min(1).max(32);

export const sgcQuerySchema = z.object({
  meterType: meterTypeSchema,
});

export const contractInfoQuerySchema = z.object({
  meterCode: meterCodeSchema,
  meterType: meterTypeSchema,
});

export const changeDecoderQuerySchema = z.object({
  meterCode: meterCodeSchema,
  meterType: meterTypeSchema,
  sgcId: z.string().min(1),
});

export const clearTokenQuerySchema = z.object({
  meterCode: meterCodeSchema,
  meterType: meterTypeSchema,
});

export const maxPowerQuerySchema = z.object({
  meterCode: meterCodeSchema,
  power: z.coerce.number().int().positive(),
});

export const vendingQuerySchema = z.object({
  meterCode: meterCodeSchema,
  meterType: meterTypeSchema,
  amountOrQuantity: z.coerce.number().positive(),
  vendingType: vendingTypeSchema.optional(),
});

export const meterDeleteBodySchema = z.object({
  meterCode: meterCodeSchema,
  meterType: meterTypeSchema,
});

export const meterRegisterBodySchema = z.object({
  useTypeId: z.string().min(1),
  meterCode: z.string().min(1),
  meterType: meterTypeSchema,
  customerName: z.string().min(1),
  address: z.string().optional(),
  phoneNumber: z.string().optional(),
  fax: z.string().optional(),
  sgcId: z.string().optional(),
  billingMode: vendingTypeSchema.optional(),
});

export const meterUpdateBodySchema = z.object({
  meterCode: meterCodeSchema,
  meterType: meterTypeSchema,
  customerName: z.string().min(1),
  address: z.string().optional(),
  phoneNumber: z.string().optional(),
  useTypeId: z.string().optional(),
  sgcId: z.string().optional(),
  billingMode: vendingTypeSchema.optional(),
});

export const addUseTypeBodySchema = z.object({
  useTypeId: z.string().min(1),
  useTypeName: z.string().min(1),
  meterType: meterTypeSchema,
  price: z.coerce.number().positive(),
  vat: z.coerce.number().min(0),
});

export const updateUseTypeBodySchema = z.object({
  price: z.coerce.number().positive(),
  vat: z.coerce.number().min(0),
});

export const useTypeParamSchema = z.object({
  useTypeId: z.string().min(1),
});

export const waterVendPageQuerySchema = z.object({
  pageNumber: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const waterVendPageBodySchema = z.object({
  meterCode: meterCodeSchema,
  startDate: z.iso.date(),
  endDate: z.iso.date(),
});
