import { env } from "../../config";
import { SANDBOX_CREDENTIALS } from "./constants";

export function getShortcode(): string {
  if (env.MPESA_ENVIRONMENT === "sandbox") {
    return SANDBOX_CREDENTIALS.shortcode;
  }
  return env.MPESA_SHORTCODE;
}

export function getPasskey(): string {
  if (env.MPESA_ENVIRONMENT === "sandbox") {
    return SANDBOX_CREDENTIALS.passkey;
  }
  return env.MPESA_PASSKEY;
}

export function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

export function generatePassword(timestamp: string): string {
  const str = `${getShortcode()}${getPasskey()}${timestamp}`;
  return Buffer.from(str).toString("base64");
}
