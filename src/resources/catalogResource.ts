import { Resource, ResourceTemplate } from "@modelcontextprotocol/sdk/types.js";
import { withErrorHandling } from "../utils/errors.js";
import { CatalogService } from "../services/catalogService.js";

export const CATALOG_URI = "tarigri://catalog";

export function getCatalogResources(): Resource[] {
  return [
    {
      uri: CATALOG_URI,
      name: "Tarigri Surgical full wholesale catalog",
      description: "All categories and products with USD wholesale prices, MOQs and volume tiers.",
      mimeType: "application/json",
    },
  ];
}

export function getCatalogResourceTemplates(): ResourceTemplate[] {
  return [
    {
      uriTemplate: "tarigri://product/{sku}",
      name: "Tarigri product",
      description: "A single product by SKU, e.g. tarigri://product/NH-301.",
      mimeType: "application/json",
    },
  ];
}

export async function handleReadCatalogResource(uri: string, service: CatalogService) {
  return withErrorHandling(`read_resource:${uri}`, async () => {
    let payload: unknown;
    if (uri === CATALOG_URI) {
      payload = await service.getCatalog();
    } else {
      const match = uri.match(/^tarigri:\/\/product\/([^/]+)$/);
      if (!match) {
        throw new Error("Invalid resource URI format");
      }
      const sku = decodeURIComponent(match[1]);
      payload = await service.getProduct(sku);
      if (!payload) {
        throw new Error(`No product with SKU "${sku}"`);
      }
    }
    return {
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(payload, null, 2) }],
    };
  });
}
