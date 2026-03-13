import { serve } from "@hono/node-server";
import { env } from "./config";
import { closeAllQueues, startQueueWorkers } from "./queues";
import { createApp } from "./app";
import { startAlertAutomation, stopAlertAutomation } from "./services/alert-automation.service";
import {
  resolveProcessRole,
  shouldStartApiServer,
  shouldStartBackgroundServices,
} from "./runtime/process-role";

const processRole = resolveProcessRole(process.env.SFM_PROCESS_ROLE);
const startApiServer = shouldStartApiServer(processRole);
const startBackground = shouldStartBackgroundServices(processRole);

let server: ReturnType<typeof serve> | null = null;

if (startBackground) {
  startQueueWorkers();
  startAlertAutomation();
}

if (startApiServer) {
  const app = createApp();
  server = serve({
    fetch: app.fetch,
    port: env.PORT,
  });

  console.log(`
Smart Flow Metering API is running!
Environment: ${env.NODE_ENV}
Role: ${processRole}
Port: ${env.PORT}
URL: http://localhost:${env.PORT}
`);
} else {
  console.log(`
Smart Flow Metering worker is running!
Environment: ${env.NODE_ENV}
Role: ${processRole}
`);
}

const shutdown = async () => {
  console.log("\n[Shutdown] Received signal, closing gracefully...");
  try {
    stopAlertAutomation();
    await closeAllQueues();
  } finally {
    server?.close();
    process.exit(0);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
