import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CatalogService } from "./services/catalogService.js";
import { registerCatalogTools } from "./tools/catalogTools.js";
import { registerCatalogResources } from "./resources/catalogResources.js";
import { registerBuyerPrompts } from "./prompts/buyerPrompts.js";

// Keep in sync with package.json (checked by tests/server.test.ts).
export const SERVER_VERSION = "1.0.0";

const INSTRUCTIONS =
  "Read-only access to the Tarigri Surgical Instruments wholesale catalog (tarigrisurgical.com, Sialkot, Pakistan). " +
  "Prices are factory-direct wholesale in USD, FOB Sialkot; shipping is quoted separately by Tarigri. " +
  "Use search_products / get_product to find items, estimate_quote to price quantities (volume tiers at 50+/100+, MOQ applies), " +
  "and draft_inquiry to prepare an email/WhatsApp request. Nothing is ordered or sent by this server. " +
  "CE/ISO documentation is available on request; certificate numbers are not published.";

/** Builds a fully-registered server. Transport-agnostic: used by stdio and HTTP entry points. */
export function createServer(service: CatalogService): McpServer {
  const server = new McpServer(
    {
      name: "tarigri-surgical",
      title: "Tarigri Surgical Instruments",
      version: SERVER_VERSION,
      websiteUrl: "https://www.tarigrisurgical.com",
    },
    { instructions: INSTRUCTIONS },
  );
  registerCatalogTools(server, service);
  registerCatalogResources(server, service);
  registerBuyerPrompts(server);
  return server;
}
