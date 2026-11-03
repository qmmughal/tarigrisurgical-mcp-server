import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListResourcesRequestSchema, ReadResourceRequestSchema, ListResourceTemplatesRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { CatalogService } from "../services/catalogService.js";
import { CATALOG_URI, getCatalogResources, getCatalogResourceTemplates, handleReadCatalogResource } from "./catalogResource.js";

export function registerResources(server: Server, service: CatalogService) {
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: getCatalogResources() };
  });

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return { resourceTemplates: getCatalogResourceTemplates() };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    if (uri === CATALOG_URI || uri.startsWith("tarigri://product/")) {
      return await handleReadCatalogResource(uri, service);
    }

    throw new McpError(ErrorCode.InvalidRequest, `Unknown resource URI: ${uri}`);
  });
}
