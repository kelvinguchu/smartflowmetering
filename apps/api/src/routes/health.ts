import { Elysia } from "elysia";
import { db } from "../db";
import { getQueueHealth } from "../queues";

/**
 * Health Check Routes
 *
 * Provides system health information
 */
export const healthRoutes = new Elysia({ prefix: "/health" })
  /**
   * Basic health check
   */
  .get("/", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "ohmkenya-api",
  }))

  /**
   * Detailed health check with dependencies
   */
  .get("/detailed", async () => {
    const checks: Record<
      string,
      { status: string; latency?: number; error?: string; data?: unknown }
    > = {};

    // Check database
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

    // Check Redis/Queues
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

    const allHealthy = Object.values(checks).every((c) => c.status === "ok");

    return {
      status: allHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    };
  })

  /**
   * Queue status endpoint
   */
  .get("/queues", async () => {
    try {
      const queueHealth = await getQueueHealth();
      return {
        status: "ok",
        queues: queueHealth,
      };
    } catch (error) {
      return {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });
