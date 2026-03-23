import { and, desc, eq } from "drizzle-orm";
import assert from "node:assert/strict";
import { db } from "../../src/db";
import { tenantAppAccesses } from "../../src/db/schema";

export async function getLatestTenantAccessIdForMeter(
  meterId: string,
): Promise<string> {
  const access = await db.query.tenantAppAccesses.findFirst({
    where: and(
      eq(tenantAppAccesses.meterId, meterId),
      eq(tenantAppAccesses.status, "active"),
    ),
    columns: {
      id: true,
    },
    orderBy: [desc(tenantAppAccesses.createdAt)],
  });

  assert.ok(access, "Expected an active tenant access to exist for the meter");
  return access.id;
}
