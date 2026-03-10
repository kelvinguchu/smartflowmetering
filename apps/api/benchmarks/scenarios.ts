/**
 * Benchmark scenarios — grouped by auth requirement.
 *
 * Public scenarios hit unauthenticated endpoints.
 * Authenticated scenarios require a session cookie (passed via --cookie flag).
 */
import type { Scenario } from "./config";

/** Endpoints that require no auth — good for raw throughput baselines */
export const publicScenarios: Scenario[] = [
  {
    title: "GET / (root info)",
    path: "/",
  },
  {
    title: "GET /api/health (basic)",
    path: "/api/health",
  },
  {
    title: "GET /api/health/detailed (DB+queues)",
    path: "/api/health/detailed",
  },
];

/** Endpoints requiring an active session cookie */
export function authenticatedScenarios(cookie: string): Scenario[] {
  const headers = { Cookie: cookie };
  return [
    {
      title: "GET /api/meters (list)",
      path: "/api/meters",
      headers,
    },
    {
      title: "GET /api/tariffs (active tariffs)",
      path: "/api/tariffs",
      headers,
    },
    {
      title: "GET /api/transactions (list)",
      path: "/api/transactions",
      headers,
    },
    {
      title: "GET /api/applications (list)",
      path: "/api/applications",
      headers,
    },
    {
      title: "GET /api/notifications (list)",
      path: "/api/notifications",
      headers,
    },
  ];
}
