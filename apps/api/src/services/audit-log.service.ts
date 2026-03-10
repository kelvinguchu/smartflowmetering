import { db } from "../db";
import { auditLogs } from "../db/schema";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AuditLogInput {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export async function writeAuditLog(input: AuditLogInput) {
  const resolvedUserId = toAuditUserId(input.userId);
  const details = {
    ...input.details,
    actorUserId: input.userId,
  };

  await db.insert(auditLogs).values({
    userId: resolvedUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    details,
    ipAddress: input.ipAddress ?? null,
  });
}

export function extractClientIp(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  return null;
}

function toAuditUserId(userId: string): string {
  if (UUID_REGEX.test(userId)) return userId;
  return NIL_UUID;
}
