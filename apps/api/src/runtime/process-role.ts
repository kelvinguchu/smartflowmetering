export type ProcessRole = "all" | "api" | "worker";

export function resolveProcessRole(value: string | undefined): ProcessRole {
  if (value === "api" || value === "worker" || value === "all") {
    return value;
  }

  return "all";
}

export function shouldStartApiServer(role: ProcessRole): boolean {
  return role === "all" || role === "api";
}

export function shouldStartBackgroundServices(role: ProcessRole): boolean {
  return role === "all" || role === "worker";
}
