import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logger } from "./utils/logger.js";
// Ensure env is parsed and valid
import { env } from "./config/env.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import { CatalogService } from "./services/catalogService.js";

class McpServer {
  private server: Server;
  private service: CatalogService;

  constructor() {
    this.server = new Server(
      {
        name: "tarigri-surgical-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.service = new CatalogService({
      origin: env.TARIGRI_SITE_ORIGIN,
      cacheTtlSeconds: env.CATALOG_CACHE_TTL_SECONDS,
    });

    // Register capabilities
    registerTools(this.server, this.service);
    registerResources(this.server, this.service);
    registerPrompts(this.server);

    // Setup error handling
    this.server.onerror = (error) => {
      logger.error({ error }, "MCP Server Error");
    };

    process.on("SIGINT", async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  public async start() {
    logger.info("Starting MCP Server...");
    const transport = new StdioServerTransport();
    
    await this.server.connect(transport);
    logger.info("MCP Server started and connected via stdio");
  }

  private async cleanup() {
    logger.info("Shutting down MCP Server...");
    await this.server.close();
  }
}

const server = new McpServer();
server.start().catch((error) => {
  logger.fatal({ error }, "Failed to start server");
  process.exit(1);
});
