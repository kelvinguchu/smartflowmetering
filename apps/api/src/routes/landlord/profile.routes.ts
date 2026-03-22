import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { LandlordAppBindings } from "../../lib/landlord-access-middleware";
import { requireLandlordAccess } from "../../lib/landlord-access-middleware";
import { authRateLimit } from "../../lib/rate-limit";
import { upsertCustomerDeviceToken } from "../../services/customer/customer-device-tokens.service";
import {
  sendLandlordAccessOtp,
  verifyLandlordAccessOtp,
} from "../../services/landlord/landlord-mobile-auth.service";
import {
  toPublicCustomerDeviceToken,
  toPublicLandlordAccess,
  toPublicLandlordUser,
} from "../../services/customer/mobile-public-response.service";
import {
  landlordDeviceTokenUpsertSchema,
  landlordSendOtpSchema,
  landlordVerifyOtpSchema,
} from "../../validators/landlord-access";

export const landlordAccessProfileRoutes = new Hono<LandlordAppBindings>();

landlordAccessProfileRoutes.post(
  "/send-otp",
  authRateLimit,
  zValidator("json", landlordSendOtpSchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await sendLandlordAccessOtp(c.req.raw.headers, body.phoneNumber);
    return c.json({
      data: { phoneNumber: result.normalizedPhoneNumber },
      message: "OTP sent",
    });
  },
);

landlordAccessProfileRoutes.post(
  "/verify-otp",
  authRateLimit,
  zValidator("json", landlordVerifyOtpSchema),
  async (c) => {
    const body = c.req.valid("json");
    const result = await verifyLandlordAccessOtp(c.req.raw.headers, body);
    return c.json({
      data: {
        landlordAccess: toPublicLandlordAccess(result.landlordAccess),
        token: result.token,
        user: toPublicLandlordUser(result.user),
      },
    });
  },
);

landlordAccessProfileRoutes.use("*", requireLandlordAccess);

landlordAccessProfileRoutes.get("/me", (c) =>
  c.json({
    data: {
      landlordAccess: toPublicLandlordAccess(c.get("landlordAccess")),
      user: toPublicLandlordUser(c.get("user")),
    },
  }),
);

landlordAccessProfileRoutes.post(
  "/device-tokens",
  zValidator("json", landlordDeviceTokenUpsertSchema),
  async (c) => {
    const body = c.req.valid("json");
    const landlordAccess = c.get("landlordAccess");
    const data = await upsertCustomerDeviceToken({
      landlordId: landlordAccess.customerId,
      platform: body.platform,
      token: body.token,
    });
    return c.json({
      data: toPublicCustomerDeviceToken(data),
      message: "Landlord device token saved",
    });
  },
);






