import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const TOKEN_PROTECTION_PREFIX = "enc:v1";
const TOKEN_ALGORITHM = "aes-256-gcm";

export function protectToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(TOKEN_ALGORITHM, getTokenProtectionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    TOKEN_PROTECTION_PREFIX,
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    authTag.toString("base64url"),
  ].join(":");
}

export function revealToken(storedToken: string): string {
  if (!isProtectedToken(storedToken)) {
    return storedToken;
  }

  const payload = storedToken.slice(`${TOKEN_PROTECTION_PREFIX}:`.length);
  const [ivRaw, encryptedRaw, authTagRaw] = payload.split(":");
  if (!ivRaw || !encryptedRaw || !authTagRaw) {
    throw new Error("Invalid protected token format");
  }

  const decipher = createDecipheriv(
    TOKEN_ALGORITHM,
    getTokenProtectionKey(),
    Buffer.from(ivRaw, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTagRaw, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function isProtectedToken(value: string): boolean {
  return value.startsWith(`${TOKEN_PROTECTION_PREFIX}:`);
}

function getTokenProtectionKey(): Buffer {
  const secret =
    process.env.TOKEN_ENCRYPTION_SECRET?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    (process.env.NODE_ENV === "production"
      ? ""
      : "smartflowmetering-dev-token-secret");

  if (!secret) {
    throw new Error(
      "Token encryption secret is not configured. Set TOKEN_ENCRYPTION_SECRET or BETTER_AUTH_SECRET."
    );
  }

  return createHash("sha256").update(secret).digest();
}
