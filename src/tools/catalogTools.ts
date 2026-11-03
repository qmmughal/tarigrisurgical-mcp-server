import { z } from "zod";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { validateArgs, withErrorHandling } from "../utils/errors.js";
import { CatalogService, FAQS } from "../services/catalogService.js";

const searchProductsSchema = z.object({
  query: z.string().optional().describe("Free-text terms, e.g. 'needle holder' or 'sc-101'"),
  category: z.string().optional().describe("Category id or name (see list_categories)"),
  max_unit_price_usd: z.number().positive().optional(),
  featured_only: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const getProductSchema = z.object({
  sku: z.string().min(1).describe("Product SKU, e.g. NH-301"),
});

const estimateQuoteSchema = z.object({
  items: z
    .array(z.object({ sku: z.string().min(1), quantity: z.number().int().min(1) }))
    .min(1)
    .max(50),
});

const draftInquirySchema = z.object({
  items: z
    .array(z.object({ sku: z.string().min(1), quantity: z.number().int().min(1) }))
    .min(1)
    .max(50),
  buyer_name: z.string().optional(),
  company: z.string().optional(),
  destination_country: z.string().optional().describe("Country the goods ship to; Tarigri quotes shipping per destination"),
  notes: z.string().max(2000).optional().describe("e.g. OEM/private label, CE/ISO documents, sample requests"),
});

export function getCatalogToolDefinitions(): Tool[] {
  return [
    {
      name: "search_products",
      description:
        "Search the Tarigri Surgical wholesale catalog (surgical, dental, orthopedic, ENT instruments). Prices are USD per unit, FOB Sialkot. All filters are optional.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text terms, e.g. 'needle holder' or 'sc-101'" },
          category: { type: "string", description: "Category id or name (see list_categories)" },
          max_unit_price_usd: { type: "number", description: "Only products at or below this base unit price" },
          featured_only: { type: "boolean", description: "Only best sellers" },
          limit: { type: "number", description: "Max results (1-50, default 25)" },
        },
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    {
      name: "get_product",
      description: "Get full details for one product by SKU: price, MOQ, volume tiers, material, size, description, URL.",
      inputSchema: {
        type: "object",
        properties: { sku: { type: "string", description: "Product SKU, e.g. NH-301" } },
        required: ["sku"],
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    {
      name: "list_categories",
      description: "List the product categories with descriptions and product counts.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    {
      name: "estimate_quote",
      description:
        "Compute an indicative wholesale price for a list of SKUs and quantities, applying volume tiers (50+/100+) and flagging quantities below MOQ. Excludes shipping; Tarigri issues the final quotation.",
      inputSchema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: { sku: { type: "string" }, quantity: { type: "number" } },
              required: ["sku", "quantity"],
            },
          },
        },
        required: ["items"],
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    {
      name: "get_company_info",
      description: "Tarigri Surgical contact details, business hours, ordering process, and buyer FAQ (MOQ, OEM, CE/ISO, markets, pricing).",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    {
      name: "draft_inquiry",
      description:
        "Draft a wholesale order request for Tarigri as email text plus ready-to-click mailto: and WhatsApp links. Nothing is sent; the user must open the link and send it themselves.",
      inputSchema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: { sku: { type: "string" }, quantity: { type: "number" } },
              required: ["sku", "quantity"],
            },
          },
          buyer_name: { type: "string" },
          company: { type: "string" },
          destination_country: { type: "string", description: "Country the goods ship to" },
          notes: { type: "string", description: "e.g. OEM/private label, CE/ISO documents, samples" },
        },
        required: ["items"],
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
  ];
}

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

export async function handleCatalogTool(name: string, args: unknown, service: CatalogService) {
  return withErrorHandling(name, async () => {
    switch (name) {
      case "search_products": {
        const a = validateArgs(searchProductsSchema, args ?? {});
        const results = await service.searchProducts({
          query: a.query,
          category: a.category,
          maxUnitPriceUsd: a.max_unit_price_usd,
          featuredOnly: a.featured_only,
          limit: a.limit,
        });
        return json({ count: results.length, currency: "USD", incoterm: "FOB Sialkot", products: results });
      }
      case "get_product": {
        const a = validateArgs(getProductSchema, args);
        const product = await service.getProduct(a.sku);
        if (!product) {
          throw new Error(`No product with SKU "${a.sku}". Use search_products to find valid SKUs.`);
        }
        return json(product);
      }
      case "list_categories": {
        return json((await service.getCatalog()).categories);
      }
      case "estimate_quote": {
        const a = validateArgs(estimateQuoteSchema, args);
        return json(await service.estimateQuote(a.items));
      }
      case "get_company_info": {
        const { site } = await service.getCatalog();
        return json({
          name: site.name,
          tagline: site.tagline,
          location: `${site.city}, ${site.region}, ${site.country}`,
          email: site.email,
          phone: site.phoneText,
          whatsapp: `https://wa.me/${site.whatsapp}`,
          hours: site.hoursText,
          website: site.origin,
          trustLine: site.trustLine,
          faq: FAQS,
        });
      }
      case "draft_inquiry": {
        const a = validateArgs(draftInquirySchema, args);
        const { site } = await service.getCatalog();
        const quote = await service.estimateQuote(a.items);
        const lines = quote.lines.map(
          (l) => `- ${l.sku} ${l.name}: ${l.quantity} ${l.unit} (indicative USD ${l.unitPriceUsd.toFixed(2)} each)`,
        );
        const body = [
          `Hello ${site.name} team,`,
          "",
          "I would like a quotation for the following items:",
          ...lines,
          "",
          a.destination_country ? `Destination country: ${a.destination_country}` : "Please advise shipping cost to my country.",
          a.notes ? `Notes: ${a.notes}` : "",
          "",
          "Regards,",
          [a.buyer_name, a.company].filter(Boolean).join(", "),
        ]
          .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
          .join("\n")
          .trim();
        const subject = `Quotation request: ${quote.lines.length} item(s)${a.company ? ` - ${a.company}` : ""}`;
        return json({
          sent: false,
          subject,
          body,
          indicativeSubtotalUsd: quote.subtotalUsd,
          warnings: quote.notes,
          mailto: `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
          whatsapp: `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(`${subject}\n\n${body}`)}`,
        });
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });
}
