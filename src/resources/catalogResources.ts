import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CatalogService } from "../services/catalogService.js";

export function registerCatalogResources(server: McpServer, service: CatalogService) {
  server.registerResource(
    "catalog",
    "tarigri://catalog",
    {
      title: "Full wholesale catalog",
      description: "All categories and products with USD wholesale prices, MOQs and volume tiers.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await service.getCatalog(), null, 2) }],
    }),
  );

  server.registerResource(
    "product",
    new ResourceTemplate("tarigri://product/{sku}", {
      list: async () => ({
        resources: (await service.getCatalog()).products.map((p) => ({
          uri: `tarigri://product/${p.sku}`,
          name: p.sku,
          title: p.name,
          mimeType: "application/json",
        })),
      }),
      complete: {
        sku: async (value) =>
          (await service.getCatalog()).products.map((p) => p.sku).filter((s) => s.toLowerCase().startsWith(value.toLowerCase())),
      },
    }),
    {
      title: "Product by SKU",
      description: "A single product, e.g. tarigri://product/NH-301.",
      mimeType: "application/json",
    },
    async (uri, { sku }) => {
      const product = await service.getProduct(decodeURIComponent(String(sku)));
      if (!product) {
        throw new Error(`No product with SKU "${sku}"`);
      }
      return {
        contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(product, null, 2) }],
      };
    },
  );
}
