import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { env } from "./config";
import {
  mpesaRoutes,
  meterRoutes,
  tariffRoutes,
  transactionRoutes,
  healthRoutes,
  smsRoutes,
  gomelongRoutes,
  applicationRoutes,
  motherMeterRoutes,
  notificationRoutes,
  failedTransactionRoutes,
} from "./routes";
import { auth } from "./lib/auth";
import { rateLimitMiddleware } from "./lib/rate-limit";
import type { AppBindings } from "./lib/auth-middleware";

export function createApp() {
  const app = new Hono<AppBindings>();

  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return error.getResponse();
    }

    console.error("[Error]", error);

    return c.json(
      {
        error: "Internal Server Error",
        message: env.NODE_ENV === "development" ? error.message : undefined,
      },
      500
    );
  });

  app.notFound((c) => c.json({ error: "Not Found" }, 404));

  app.use("*", async (c, next) => {
    if (env.NODE_ENV === "development") {
      console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.url}`);
    }
    await next();
  });

  app.use(
    "*",
    cors({
      origin: env.CORS_ORIGINS,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  );

  app.use("*", rateLimitMiddleware);

  app.all("/api/auth/*", async (c) => auth.handler(c.req.raw));

  app.get("/", (c) =>
    c.json({
      name: "Smart Flow Metering API",
      version: "1.0.0",
      docs: null,
    })
  );

  app.route("/api/health", healthRoutes);
  app.route("/api/mpesa", mpesaRoutes);
  app.route("/api/meters", meterRoutes);
  app.route("/api/tariffs", tariffRoutes);
  app.route("/api/transactions", transactionRoutes);
  app.route("/api/sms", smsRoutes);
  app.route("/api/gomelong", gomelongRoutes);
  app.route("/api/applications", applicationRoutes);
  app.route("/api/mother-meters", motherMeterRoutes);
  app.route("/api/notifications", notificationRoutes);
  app.route("/api/failed-transactions", failedTransactionRoutes);

  return app;
}

export type App = ReturnType<typeof createApp>;
