import { Hono } from "hono";
import { db } from "../db";
import { requirePermission } from "../lib/auth-middleware";
import type { AppBindings } from "../lib/auth-middleware";
import { getQueueHealth } from "../queues";

/**
 * Health Check Routes
 *
 * Provides system health information
 */
export const healthRoutes = new Hono<AppBindings>();

interface HealthCheckResult {
  status: "ok" | "error";
  latency?: number;
  error?: string;
  data?: Awaited<ReturnType<typeof getQueueHealth>>;
}

healthRoutes.get("/", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "smartflowmetering-api",
  })
);

healthRoutes.use("/detailed", requirePermission("system:diagnostics:read"));
healthRoutes.use("/queues", requirePermission("system:diagnostics:read"));

healthRoutes.get("/detailed", async (c) => {
  const checks: Record<string, HealthCheckResult> = {};

  const dbStart = Date.now();
  try {
    await db.execute("SELECT 1");
    checks.database = {
      status: "ok",
      latency: Date.now() - dbStart,
    };
  } catch (error) {
    checks.database = {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  const queueStart = Date.now();
  try {
    const queueHealth = await getQueueHealth();
    checks.queues = {
      status: "ok",
      latency: Date.now() - queueStart,
      data: queueHealth,
    };
  } catch (error) {
    checks.queues = {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  const allHealthy = Object.values(checks).every((result) => result.status === "ok");

  return c.json({
    status: allHealthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
  });
});

healthRoutes.get("/queues", async (c) => {
  try {
    const queueHealth = await getQueueHealth();
    return c.json({
      status: "ok",
      queues: queueHealth,
    });
  } catch (error) {
    return c.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});
