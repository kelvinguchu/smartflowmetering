import { and, count, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../../db";
import { auditLogs, user } from "../../db/schema";
import type { AuditLogListQuery } from "../../validators/audit-logs";

type AuditLogDetailValue =
  | boolean
  | boolean[]
  | number
  | number[]
  | string
  | string[]
  | null;
type AuditLogDetailObject = Record<string, AuditLogDetailValue>;

interface AuditLogActorDto {
  email: string;
  id: string;
  name: string;
}

export interface AuditLogDto {
  action: string;
  actor: AuditLogActorDto | null;
  createdAt: string;
  details: AuditLogDetailObject | null;
  entityId: string;
  entityType: string;
  id: string;
  ipAddress: string | null;
}

export interface AuditLogListResult {
  logs: AuditLogDto[];
  total: number;
}

export async function listAuditLogs(
  query: AuditLogListQuery,
): Promise<AuditLogListResult> {
  const filters = buildAuditLogFilters(query);
  const whereClause = filters.length > 0 ? and(...filters) : undefined;
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(auditLogs)
      .where(whereClause),
  ]);

  return {
    logs: await toAuditLogDtos(rows),
    total: totalRows[0]?.value ?? 0,
  };
}

export async function getAuditLog(logId: string): Promise<AuditLogDto> {
  const rows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.id, logId))
    .limit(1);

  if (rows.length === 0) {
    throw new HTTPException(404, {
      message: "Audit log not found",
    });
  }

  const logs = await toAuditLogDtos(rows);
  return logs[0];
}

async function toAuditLogDtos(
  rows: typeof auditLogs.$inferSelect[],
): Promise<AuditLogDto[]> {
  const actorIds = [...new Set(rows.map((row) => row.userId).filter(Boolean))];
  const actors = actorIds.length
    ? await db
        .select({
          email: user.email,
          id: user.id,
          name: user.name,
        })
        .from(user)
        .where(inArray(user.id, actorIds))
    : [];

  const actorMap = new Map(
    actors.map((actor) => [
      actor.id,
      {
        email: actor.email,
        id: actor.id,
        name: actor.name,
      },
    ]),
  );

  return rows.map((row) => ({
    action: row.action,
    actor: actorMap.get(row.userId) ?? null,
    createdAt: row.createdAt.toISOString(),
    details: normalizeDetails(row.details),
    entityId: row.entityId,
    entityType: row.entityType,
    id: row.id,
    ipAddress: row.ipAddress ?? null,
  }));
}

function buildAuditLogFilters(query: AuditLogListQuery) {
  const filters = [];

  if (query.action) {
    filters.push(eq(auditLogs.action, query.action));
  }
  if (query.actorUserId) {
    filters.push(eq(auditLogs.userId, query.actorUserId));
  }
  if (query.entityId) {
    filters.push(eq(auditLogs.entityId, query.entityId));
  }
  if (query.entityType) {
    filters.push(eq(auditLogs.entityType, query.entityType));
  }
  if (query.from) {
    filters.push(gte(auditLogs.createdAt, new Date(query.from)));
  }
  if (query.to) {
    filters.push(lte(auditLogs.createdAt, new Date(query.to)));
  }

  return filters;
}

function normalizeDetails(
  value: typeof auditLogs.$inferSelect.details,
): AuditLogDetailObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as AuditLogDetailObject;
}



