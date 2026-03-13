import { z } from "zod";

export const auditLogIdParamSchema = z.object({
  id: z.uuid(),
});

export const auditLogListQuerySchema = z.object({
  action: z.string().min(1).optional(),
  actorUserId: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
  entityType: z.string().min(1).optional(),
  from: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  to: z.iso.datetime().optional(),
});

export type AuditLogListQuery = z.infer<typeof auditLogListQuerySchema>;
