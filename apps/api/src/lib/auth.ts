import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, twoFactor } from "better-auth/plugins";
import { env } from "../config";
import { db } from "../db";
import { sendSms } from "../services/sms.service";
import { shouldDisablePublicSignUp } from "./auth-config";
import {
  isAllowedKenyanPhoneNumber,
  normalizeKenyanPhoneNumber,
} from "./staff-contact";

/**
 * Better-Auth configuration for Smart Flow Metering
 *
 * Features:
 * - Email/password authentication
 * - Admin plugin for RBAC (admin/user roles)
 * - 2FA with TOTP (authenticator apps)
 * - Backup codes for account recovery
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),

  user: {
    additionalFields: {
      phoneNumber: {
        type: "string",
        required: true,
        unique: true,
      },
      phoneNumberVerified: {
        type: "boolean",
        required: true,
        defaultValue: true,
      },
      preferredTwoFactorMethod: {
        type: "string",
        required: true,
        defaultValue: "sms",
      },
      totpEnrollmentPromptPending: {
        type: "boolean",
        required: true,
        defaultValue: true,
      },
    },
  },

  // Base URL for callbacks
  baseURL: env.BETTER_AUTH_URL,

  // Base path for auth routes (e.g., /api/auth)
  basePath: "/api/auth",

  // Secret for signing tokens
  secret: env.BETTER_AUTH_SECRET,

  // Email/password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    disableSignUp: shouldDisablePublicSignUp(env.NODE_ENV),
  },

  // Disable public sign-up
  advanced: {
    disableCSRFCheck: false,
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },

  // Plugins
  plugins: [
    // Admin plugin for role-based access control
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),

    // Two-factor authentication via SMS OTP and TOTP
    twoFactor({
      issuer: "Smart Flow Metering",
      otpOptions: {
        allowedAttempts: 5,
        digits: 6,
        period: 3,
        sendOTP: async ({ otp, user }) => {
          const phoneNumber = getTwoFactorUserPhoneNumber(user);

          if (!phoneNumber || !isAllowedKenyanPhoneNumber(phoneNumber)) {
            throw new Error("A verified Kenyan phone number is required for SMS 2FA");
          }

          const normalizedPhoneNumber = normalizeKenyanPhoneNumber(phoneNumber);
          await sendSms(
            normalizedPhoneNumber,
            `Smart Flow Metering login code: ${otp}. It expires in 3 minutes.`,
          );
        },
      },
      totpOptions: {
        digits: 6,
      },
    }),
  ],

  // Trusted origins for CORS
  trustedOrigins: env.CORS_ORIGINS,
});

// Export types for use in routes
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session["user"];

interface TwoFactorUserWithPhoneNumber {
  id: string;
  phoneNumber?: string | null;
}

function getTwoFactorUserPhoneNumber(
  user: TwoFactorUserWithPhoneNumber,
): string | null {
  return typeof user.phoneNumber === "string" ? user.phoneNumber : null;
}
