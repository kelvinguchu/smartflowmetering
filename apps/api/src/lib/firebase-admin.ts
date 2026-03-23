import type { App, ServiceAccount } from "firebase-admin/app";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import type { BatchResponse, MulticastMessage } from "firebase-admin/messaging";
import { getMessaging } from "firebase-admin/messaging";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "../config";

export interface MessagingLike {
  sendEachForMulticast(
    message: MulticastMessage,
    dryRun?: boolean,
  ): Promise<BatchResponse>;
}

let messagingOverride: MessagingLike | null = null;

export function getFirebaseMessaging(): MessagingLike | null {
  if (!env.FCM_ENABLED) {
    return null;
  }

  if (messagingOverride) {
    return messagingOverride;
  }

  const app = getFirebaseApp();
  return getMessaging(app);
}

export function setFirebaseMessagingForTests(messaging: MessagingLike | null): void {
  messagingOverride = messaging;
}

function getFirebaseApp(): App {
  const existing = getApps().find((app) => app.name === "smart-flow-metering");
  if (existing) {
    return existing;
  }

  const serviceAccountPath = resolve(env.FIREBASE_SERVICE_ACCOUNT_PATH);
  const serviceAccount = JSON.parse(
    readFileSync(serviceAccountPath, "utf8"),
  ) as ServiceAccount;

  return initializeApp(
    {
      credential: cert(serviceAccount),
      projectId: env.FIREBASE_PROJECT_ID || serviceAccount.projectId,
    },
    "smart-flow-metering",
  );
}
