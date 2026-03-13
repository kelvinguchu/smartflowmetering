import type {
  BatchResponse,
  MulticastMessage,
} from "firebase-admin/messaging";
import { env } from "../config";
import { getFirebaseMessaging } from "./firebase-admin";

const INVALID_TOKEN_ERROR_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

export async function sendMulticastNotification(input: {
  data: Record<string, string>;
  message: string;
  title: string;
  tokens: string[];
}): Promise<BatchResponse> {
  const messaging = getRequiredFirebaseMessaging();
  const message: MulticastMessage = {
    android: { priority: "high" },
    apns: { payload: { aps: { sound: "default" } } },
    data: input.data,
    notification: {
      body: input.message,
      title: input.title,
    },
    tokens: input.tokens,
  };

  return messaging.sendEachForMulticast(message, env.FCM_DRY_RUN);
}

export function isPermanentTokenFailure(errorCode: string | undefined): boolean {
  return errorCode ? INVALID_TOKEN_ERROR_CODES.has(errorCode) : false;
}

function getRequiredFirebaseMessaging() {
  const messaging = getFirebaseMessaging();
  if (messaging === null) {
    throw new Error("FCM is not configured");
  }

  return messaging;
}
