import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { env } from "./config";
import {
  mpesaRoutes,
  meterRoutes,
  tariffRoutes,
  transactionRoutes,
  healthRoutes,
  smsRoutes,
} from "./routes";
import { closeAllQueues } from "./queues";
import { openapi } from "@elysiajs/openapi";
import { auth } from "./lib/auth";
import { authMiddleware } from "./lib/auth-middleware";
import { rateLimitMiddleware } from "./lib/rate-limit";

const app = new Elysia()
  .onError(({ code, error, set }) => {
    // Don't log NOT_FOUND as errors - they're expected for unknown routes
    if (code !== "NOT_FOUND") {
      console.error(`[Error] ${code}:`, error);
    }

    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: "Validation Error",
        message: "message" in error ? error.message : "Invalid request",
      };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Not Found" };
    }

    // Handle auth errors from auth middleware
    if ("message" in error) {
      if (error.message.startsWith("Unauthorized:")) {
        set.status = 401;
        return { error: "Unauthorized", message: error.message };
      }
      if (error.message.startsWith("Forbidden:")) {
        set.status = 403;
        return { error: "Forbidden", message: error.message };
      }
    }

    set.status = 500;
    return {
      error: "Internal Server Error",
      message:
        env.NODE_ENV === "development" && "message" in error
          ? error.message
          : undefined,
    };
  })

  // Request logging in development
  .onBeforeHandle(({ request }) => {
    if (env.NODE_ENV === "development") {
      console.log(
        `[${new Date().toISOString()}] ${request.method} ${request.url}`
      );
    }
  })

  // CORS for frontend
  .use(
    cors({
      origin: [
        "https://ohmkenya.com",
        "http://localhost:3000",
        "http://localhost:3001",
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )

  // Rate limiting (global: 100 requests/min per IP)
  .use(rateLimitMiddleware)

  // OpenAPI docs
  .use(openapi())

  // Auth middleware (provides session/user context + auth macros)
  .use(authMiddleware)

  // Better-Auth handler - mount at root so it handles /api/auth/* paths
  .mount(auth.handler)

  // Root endpoint
  .get("/", () => ({
    name: "OHMKenya API",
    version: "1.0.0",
    docs: "/swagger",
  }))

  // Mount routes under /api
  .group("/api", (app) =>
    app
      .use(healthRoutes)
      .use(mpesaRoutes)
      .use(meterRoutes)
      .use(tariffRoutes)
      .use(transactionRoutes)
      .use(smsRoutes)
  )

  // Start server
  .listen(env.PORT);

console.log(`
🦊 OHMKenya API is running!
   Environment: ${env.NODE_ENV}
   Port: ${env.PORT}
   URL: http://${app.server?.hostname}:${app.server?.port}

📡 Available endpoints:
   GET  /api/health               - Health check
   GET  /api/health/queues        - Queue status
   
   M-Pesa:
   POST /api/mpesa/validation     - M-Pesa C2B validation URL
   POST /api/mpesa/callback       - M-Pesa C2B callback URL
   POST /api/mpesa/stk-push       - Initiate STK Push
   POST /api/mpesa/stk-push/test  - Test STK Push (254725799783)
   POST /api/mpesa/stk-push/callback - STK Push callback
   GET  /api/mpesa/stk-push/query/:id - Query STK Push status
   
   Resources:
   GET  /api/meters               - List meters
   GET  /api/tariffs              - List tariffs
   GET  /api/transactions         - List transactions

🔐 Auth (Better-Auth):
   POST /api/auth/sign-up/email   - Register new user
   POST /api/auth/sign-in/email   - Login
   GET  /api/auth/session         - Get current session
   POST /api/auth/sign-out        - Logout
   POST /api/auth/two-factor/*    - 2FA endpoints

📖 OpenAPI docs: http://${app.server?.hostname}:${app.server?.port}/swagger

🔄 Background workers started:
   - Payment processing
   - Token generation
   - SMS delivery
`);

// Graceful shutdown
const shutdown = async () => {
  console.log("\n[Shutdown] Received signal, closing gracefully...");
  await closeAllQueues();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export type App = typeof app;
