import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { CatalogService } from "../services/catalogService.js";
import { getCatalogToolDefinitions, handleCatalogTool } from "./catalogTools.js";

export function registerTools(server: Server, service: CatalogService) {
  const definitions = getCatalogToolDefinitions();
  const names = new Set(definitions.map((d) => d.name));

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: definitions };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!names.has(request.params.name)) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }
    return await handleCatalogTool(request.params.name, request.params.arguments, service);
  });
}
