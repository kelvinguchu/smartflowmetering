import { HTTPException } from "hono/http-exception";
import {
  isAllowedStaffEmail,
  normalizeKenyanPhoneNumber,
  normalizeStaffEmail,
} from "../../lib/staff-contact";
import type { PreferredTwoFactorMethod } from "../../lib/staff-contact";
import type {
  CreateManagedUserInput,
  UpdateManagedUserInput,
} from "../../validators/users";

interface ManagedUserProfileData {
  emailVerified?: boolean;
  phoneNumber?: string;
  phoneNumberVerified?: boolean;
  preferredTwoFactorMethod?: PreferredTwoFactorMethod;
  totpEnrollmentPromptPending?: boolean;
  twoFactorEnabled?: boolean;
}

interface ManagedUserCreatePayload {
  email: string;
  name: string;
  password: string;
  role: "admin" | "user";
  data: ManagedUserProfileData;
}

type ManagedUserUpdatePayload = ManagedUserProfileData & {
  email?: string;
  image?: string | null;
  name?: string;
};

export function buildManagedUserCreatePayload(
  input: CreateManagedUserInput,
): ManagedUserCreatePayload {
  const email = normalizeAndValidateEmail(input.email);

  return {
    email,
    name: input.name.trim(),
    password: input.password,
    role: input.role,
    data: {
      emailVerified: true,
      phoneNumber: normalizeKenyanPhoneNumber(input.phoneNumber),
      phoneNumberVerified: true,
      preferredTwoFactorMethod: "sms",
      totpEnrollmentPromptPending: true,
      twoFactorEnabled: true,
    },
  };
}

export function buildManagedUserUpdatePayload(
  input: UpdateManagedUserInput,
): ManagedUserUpdatePayload {
  const payload: ManagedUserUpdatePayload = {};

  if (input.email) {
    payload.email = normalizeAndValidateEmail(input.email);
  }

  if (typeof input.emailVerified === "boolean") {
    payload.emailVerified = input.emailVerified;
  }

  if (Object.prototype.hasOwnProperty.call(input, "image")) {
    payload.image = input.image ?? null;
  }

  if (input.name) {
    payload.name = input.name.trim();
  }

  if (input.phoneNumber) {
    payload.phoneNumber = normalizeKenyanPhoneNumber(input.phoneNumber);
    payload.phoneNumberVerified = true;
  }

  return payload;
}

function normalizeAndValidateEmail(email: string): string {
  const normalizedEmail = normalizeStaffEmail(email);

  if (!isAllowedStaffEmail(normalizedEmail)) {
    throw new HTTPException(422, {
      message: "Email must be @gmail.com or @smartmetering.africa",
    });
  }

  return normalizedEmail;
}


