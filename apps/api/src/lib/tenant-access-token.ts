import { createHash, randomBytes } from "node:crypto";

export function createTenantAccessToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashTenantAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
