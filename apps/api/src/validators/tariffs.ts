import { z } from "zod";

export const createTariffSchema = z.object({
  name: z.string().min(1).max(100),
  ratePerKwh: z.string(),
  currency: z.string().default("KES").optional(),
  validFrom: z.iso.datetime().optional(),
  validTo: z.iso.datetime().optional(),
});

export type CreateTariff = z.infer<typeof createTariffSchema>;

export const updateTariffSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    ratePerKwh: z.string().optional(),
    validTo: z.iso.datetime().optional(),
  })
  .strict();

export type UpdateTariff = z.infer<typeof updateTariffSchema>;
