import { z } from "zod";

export const updatePreferredTwoFactorMethodSchema = z.object({
  method: z.enum(["sms", "totp"]),
});

export type UpdatePreferredTwoFactorMethodInput = z.infer<
  typeof updatePreferredTwoFactorMethodSchema
>;
