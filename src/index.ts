#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { CatalogService } from "./services/catalogService.js";
import { createServer } from "./server.js";

const service = new CatalogService({
  origin: env.TARIGRI_SITE_ORIGIN,
  cacheTtlSeconds: env.CATALOG_CACHE_TTL_SECONDS,
});
const server = createServer(service);

server.server.onerror = (error) => {
  logger.error({ error }, "MCP Server Error");
};

async function shutdown() {
  logger.info("Shutting down MCP Server...");
  await server.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

logger.info("Starting MCP Server (stdio)...");
server.connect(new StdioServerTransport()).then(
  () => logger.info("MCP Server connected via stdio"),
  (error) => {
    logger.fatal({ error }, "Failed to start server");
    process.exit(1);
  },
);
