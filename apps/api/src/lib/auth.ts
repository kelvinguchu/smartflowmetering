import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, twoFactor } from "better-auth/plugins";
import { db } from "../db";
import { env } from "../config";

/**
 * Better-Auth configuration for OHMKenya
 *
 * Features:
 * - Email/password authentication
 * - Admin plugin for RBAC (admin/user roles)
 * - 2FA with TOTP (authenticator apps)
 * - Backup codes for account recovery
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),

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

    // Two-factor authentication (TOTP)
    twoFactor({
      issuer: "OHMKenya",
    }),
  ],

  // Trusted origins for CORS
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
  ],
});

// Export types for use in routes
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session["user"];
