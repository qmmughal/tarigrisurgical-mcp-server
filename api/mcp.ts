import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { env } from "../src/config/env.js";
import { logger } from "../src/utils/logger.js";
import { CatalogService } from "../src/services/catalogService.js";
import { createServer } from "../src/server.js";

// Module scope: survives between invocations on a warm instance, so the catalog cache is shared.
const service = new CatalogService({
  origin: env.TARIGRI_SITE_ORIGIN,
  cacheTtlSeconds: env.CATALOG_CACHE_TTL_SECONDS,
});

function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Authorization");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

/**
 * Stateless MCP over Streamable HTTP (POST /mcp). Each request gets its own
 * server + transport, which is the recommended pattern for serverless hosts.
 * The server is read-only and public, so CORS is open and no auth is required.
 */
export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") {
    // No server-initiated SSE stream and no sessions in stateless mode.
    res.setHeader("Allow", "POST, OPTIONS");
    sendJson(res, 405, { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. Send MCP JSON-RPC via POST." }, id: null });
    return;
  }

  const server = createServer(service);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error({ error }, "MCP HTTP request failed");
    if (!res.headersSent) {
      sendJson(res, 500, { jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  }
}
