import { serve } from "@hono/node-server";
import { env } from "./config";
import { closeAllQueues } from "./queues";
import { createApp } from "./app";
import { startAlertAutomation, stopAlertAutomation } from "./services/alert-automation.service";

const app = createApp();

const server = serve({
  fetch: app.fetch,
  port: env.PORT,
});

startAlertAutomation();

console.log(`
Smart Flow Metering API is running!
Environment: ${env.NODE_ENV}
Port: ${env.PORT}
URL: http://localhost:${env.PORT}
`);

const shutdown = async () => {
  console.log("\n[Shutdown] Received signal, closing gracefully...");
  try {
    stopAlertAutomation();
    await closeAllQueues();
  } finally {
    server.close();
    process.exit(0);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
