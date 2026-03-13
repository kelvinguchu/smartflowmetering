export type StaffRole = "admin" | "user";

export type StaffPermission =
  | "app_notifications:manage"
  | "customer_prompts:manage"
  | "admin_tokens:create"
  | "audit_logs:read"
  | "applications:read"
  | "applications:decide"
  | "failed_transactions:manage"
  | "meters:read"
  | "meters:write"
  | "meters:status"
  | "mother_meter_alerts:manage"
  | "notifications:manage"
  | "mpesa:health:read"
  | "provider_ops:gomelong"
  | "sms:read"
  | "sms:resend"
  | "sms:test"
  | "support_recovery:read"
  | "system:diagnostics:read"
  | "tariffs:read"
  | "tariffs:manage"
  | "transactions:read"
  | "transactions:resend_token"
  | "transactions:summary"
  | "users:manage"
  | "mother_meters:read"
  | "mother_meters:events:create"
  | "mother_meters:reconciliation:read";

const userPermissions: ReadonlySet<StaffPermission> = new Set([
  "app_notifications:manage",
  "applications:read",
  "customer_prompts:manage",
  "meters:read",
  "sms:read",
  "sms:resend",
  "support_recovery:read",
  "tariffs:read",
  "transactions:read",
  "transactions:resend_token",
  "mother_meters:read",
]);

const adminPermissions: ReadonlySet<StaffPermission> = new Set([
  ...userPermissions,
  "admin_tokens:create",
  "audit_logs:read",
  "applications:decide",
  "failed_transactions:manage",
  "meters:write",
  "meters:status",
  "mother_meter_alerts:manage",
  "mpesa:health:read",
  "notifications:manage",
  "provider_ops:gomelong",
  "sms:test",
  "system:diagnostics:read",
  "tariffs:manage",
  "transactions:summary",
  "users:manage",
  "mother_meters:events:create",
  "mother_meters:reconciliation:read",
]);

const rolePermissions: Record<StaffRole, ReadonlySet<StaffPermission>> = {
  admin: adminPermissions,
  user: userPermissions,
};

export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return role === "admin" || role === "user";
}

export function hasPermission(
  role: string | null | undefined,
  permission: StaffPermission,
): boolean {
  if (!isStaffRole(role)) {
    return false;
  }

  return rolePermissions[role].has(permission);
}
