import { z } from "zod";
import {
  isAllowedKenyanPhoneNumber,
  isAllowedStaffEmail,
} from "../lib/staff-contact";

const roleSchema = z.enum(["admin", "user"]);
const staffEmailSchema = z.email().refine(isAllowedStaffEmail, {
  message: "Email must be @gmail.com or @smartmetering.africa",
});
const staffPhoneNumberSchema = z.string().refine(isAllowedKenyanPhoneNumber, {
  message: "Phone number must be 0712345678 or 254712345678",
});

export const managedUserIdParamSchema = z.object({
  userId: z.string().min(1),
});

export const managedUserSessionParamSchema = managedUserIdParamSchema.extend({
  sessionId: z.string().min(1),
});

export const listManagedUsersQuerySchema = z.object({
  banned: z.coerce.boolean().optional(),
  emailVerified: z.coerce.boolean().optional(),
  q: z.string().min(1).optional(),
  role: roleSchema.optional(),
  searchValue: z.string().min(1).optional(),
  searchField: z.enum(["name", "email"]).optional(),
  searchOperator: z.enum(["contains", "starts_with", "ends_with"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  sortBy: z.enum(["name", "email", "createdAt", "updatedAt"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
  filterField: z
    .enum(["role", "banned", "emailVerified", "twoFactorEnabled", "name", "email"])
    .optional(),
  filterValue: z.string().min(1).optional(),
  filterOperator: z
    .enum(["eq", "ne", "contains", "starts_with", "ends_with"])
    .optional(),
  twoFactorEnabled: z.coerce.boolean().optional(),
});

export const createManagedUserSchema = z.object({
  email: staffEmailSchema,
  name: z.string().min(1).max(100),
  phoneNumber: staffPhoneNumberSchema,
  password: z.string().min(8).max(128),
  role: roleSchema.default("user"),
});

export const updateManagedUserSchema = z
  .object({
    email: staffEmailSchema.optional(),
    emailVerified: z.boolean().optional(),
    image: z.union([z.url(), z.null()]).optional(),
    name: z.string().min(1).max(100).optional(),
    phoneNumber: staffPhoneNumberSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const setManagedUserRoleSchema = z.object({
  role: roleSchema,
});

export const banManagedUserSchema = z.object({
  banReason: z.string().min(1).max(250).optional(),
  banExpiresIn: z.coerce.number().int().min(60).optional(),
  revokeSessions: z.boolean().default(true),
});

export const setManagedUserPasswordSchema = z.object({
  newPassword: z.string().min(8).max(128),
  revokeSessions: z.boolean().default(true),
});

export type ListManagedUsersQuery = z.infer<typeof listManagedUsersQuerySchema>;
export type CreateManagedUserInput = z.infer<typeof createManagedUserSchema>;
export type UpdateManagedUserInput = z.infer<typeof updateManagedUserSchema>;
export type SetManagedUserRoleInput = z.infer<typeof setManagedUserRoleSchema>;
export type BanManagedUserInput = z.infer<typeof banManagedUserSchema>;
export type SetManagedUserPasswordInput = z.infer<
  typeof setManagedUserPasswordSchema
>;
