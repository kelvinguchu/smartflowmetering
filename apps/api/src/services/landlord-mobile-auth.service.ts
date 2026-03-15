import { auth } from "../lib/auth";
import { toBetterAuthHttpException } from "../lib/better-auth-http";
import {
  getRegisteredLandlordCustomerByPhoneNumber,
  syncLandlordAuthUser,
} from "../lib/landlord-auth-support";
import { normalizeKenyanPhoneNumber } from "../lib/staff-contact";
import { getLandlordAccessByUserId } from "./landlord-access.service";

export async function sendLandlordAccessOtp(
  headers: Headers,
  phoneNumber: string,
): Promise<{ normalizedPhoneNumber: string }> {
  const normalizedPhoneNumber = normalizeKenyanPhoneNumber(phoneNumber);

  try {
    await auth.api.sendPhoneNumberOTP({
      body: { phoneNumber: normalizedPhoneNumber },
      headers,
    });
  } catch (error) {
    throw toBetterAuthHttpException(
      typeof error === "object" && error !== null ? error : null,
    );
  }

  return { normalizedPhoneNumber };
}

export async function verifyLandlordAccessOtp(
  headers: Headers,
  input: { code: string; phoneNumber: string },
) {
  const normalizedPhoneNumber = normalizeKenyanPhoneNumber(input.phoneNumber);
  const landlord = await getRegisteredLandlordCustomerByPhoneNumber(
    normalizedPhoneNumber,
  );
  if (landlord === null) {
    throw toBetterAuthHttpException({
      body: { message: "Landlord phone number is not registered" },
      status: 404,
    });
  }

  try {
    const result = await auth.api.verifyPhoneNumber({
      body: {
        code: input.code,
        phoneNumber: normalizedPhoneNumber,
      },
      headers,
    });
    await syncLandlordAuthUser(normalizedPhoneNumber, result.user.id);
    const landlordAccess = await getLandlordAccessByUserId(result.user.id);
    if (landlordAccess === null) {
      throw toBetterAuthHttpException({
        body: { message: "Landlord account is not linked" },
        status: 403,
      });
    }

    return {
      landlordAccess,
      token: result.token,
      user: {
        ...result.user,
        role: "landlord",
      } as typeof result.user & { role: string },
    };
  } catch (error) {
    throw toBetterAuthHttpException(
      typeof error === "object" && error !== null ? error : null,
    );
  }
}
