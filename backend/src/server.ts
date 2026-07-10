import http from "http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { initializeSocket } from "./shared/services/socket.service.js";

const port = env.PORT || 3000;

logger.info("server_starting", { environment: env.NODE_ENV, port });

const app = createApp();
const server = http.createServer(app);
initializeSocket(server);

server.listen(port, () => {
  logger.info("server_started", { environment: env.NODE_ENV, port });
});

function shutdown(signal: string): void {
  logger.info("shutdown_started", { signal });
  server.close((err) => {
    if (err) {
      logger.error("shutdown_failed", {
        signal,
        errorName: err.name,
        message: err.message,
      });
      process.exit(1);
    }
    logger.info("shutdown_completed", { signal });
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
