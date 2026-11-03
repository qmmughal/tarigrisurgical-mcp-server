import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CatalogService, FAQS } from "../services/catalogService.js";

const productShape = z.object({
  sku: z.string(),
  name: z.string(),
  categoryId: z.string(),
  categoryName: z.string(),
  unit: z.string(),
  unitPriceUsd: z.number().describe("Base wholesale unit price in USD, FOB Sialkot"),
  moq: z.number().describe("Minimum order quantity"),
  volumeTiers: z.array(z.object({ minQty: z.number(), unitPriceUsd: z.number() })),
  brand: z.string().optional(),
  material: z.string().optional(),
  size: z.string().optional(),
  description: z.string().optional(),
  featured: z.boolean(),
  url: z.string(),
});

const orderItems = z
  .array(
    z.object({
      sku: z.string().min(1).describe("Product SKU, e.g. SC-101"),
      quantity: z.number().int().min(1).describe("Number of units"),
    }),
  )
  .min(1)
  .max(50);

const quoteShape = z.object({
  lines: z.array(
    z.object({
      sku: z.string(),
      name: z.string(),
      quantity: z.number(),
      unit: z.string(),
      unitPriceUsd: z.number(),
      appliedTierMinQty: z.number().nullable(),
      lineTotalUsd: z.number(),
      belowMoq: z.boolean(),
      moq: z.number(),
    }),
  ),
  subtotalUsd: z.number(),
  incoterm: z.string(),
  notes: z.array(z.string()),
});

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true, // data comes from the live tarigrisurgical.com site
} as const;

const result = <T extends Record<string, unknown>>(value: T) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  structuredContent: value,
});

export function registerCatalogTools(server: McpServer, service: CatalogService) {
  server.registerTool(
    "search_products",
    {
      title: "Search products",
      description:
        "Search the Tarigri Surgical wholesale catalog (surgical, dental, orthopedic, ENT instruments). Prices are USD per unit, FOB Sialkot. All filters are optional.",
      inputSchema: {
        query: z.string().optional().describe("Free-text terms, e.g. 'needle holder' or 'sc-101'"),
        category: z.string().optional().describe("Category id or name (see list_categories)"),
        max_unit_price_usd: z.number().positive().optional().describe("Only products at or below this base unit price"),
        featured_only: z.boolean().optional().describe("Only best sellers"),
        limit: z.number().int().min(1).max(50).optional().describe("Max results (default 25)"),
      },
      outputSchema: {
        count: z.number(),
        currency: z.string(),
        incoterm: z.string(),
        products: z.array(productShape),
      },
      annotations: READ_ONLY,
    },
    async (a) => {
      const products = await service.searchProducts({
        query: a.query,
        category: a.category,
        maxUnitPriceUsd: a.max_unit_price_usd,
        featuredOnly: a.featured_only,
        limit: a.limit,
      });
      return result({ count: products.length, currency: "USD", incoterm: "FOB Sialkot", products });
    },
  );

  server.registerTool(
    "get_product",
    {
      title: "Get product",
      description: "Get full details for one product by SKU: price, MOQ, volume tiers, material, size, description, URL.",
      inputSchema: { sku: z.string().min(1).describe("Product SKU, e.g. NH-301") },
      outputSchema: { product: productShape },
      annotations: READ_ONLY,
    },
    async ({ sku }) => {
      const product = await service.getProduct(sku);
      if (!product) {
        throw new Error(`No product with SKU "${sku}". Use search_products to find valid SKUs.`);
      }
      return result({ product });
    },
  );

  server.registerTool(
    "list_categories",
    {
      title: "List categories",
      description: "List the product categories with descriptions and product counts.",
      inputSchema: {},
      outputSchema: {
        categories: z.array(
          z.object({ id: z.string(), name: z.string(), blurb: z.string(), productCount: z.number(), url: z.string() }),
        ),
      },
      annotations: READ_ONLY,
    },
    async () => result({ categories: (await service.getCatalog()).categories }),
  );

  server.registerTool(
    "estimate_quote",
    {
      title: "Estimate quote",
      description:
        "Compute an indicative wholesale price for SKUs and quantities, applying volume tiers (50+/100+) and flagging quantities below MOQ. Excludes shipping; Tarigri issues the final quotation.",
      inputSchema: { items: orderItems },
      outputSchema: quoteShape.shape,
      annotations: READ_ONLY,
    },
    async ({ items }) => result({ ...(await service.estimateQuote(items)) }),
  );

  server.registerTool(
    "get_company_info",
    {
      title: "Get company info",
      description: "Tarigri Surgical contact details, business hours, ordering process, and buyer FAQ (MOQ, OEM, CE/ISO, markets, pricing).",
      inputSchema: {},
      outputSchema: {
        name: z.string(),
        tagline: z.string(),
        location: z.string(),
        email: z.string(),
        phone: z.string(),
        whatsapp: z.string(),
        hours: z.string(),
        website: z.string(),
        faq: z.array(z.object({ q: z.string(), a: z.string() })),
      },
      annotations: READ_ONLY,
    },
    async () => {
      const { site } = await service.getCatalog();
      return result({
        name: site.name,
        tagline: site.tagline,
        location: `${site.city}, ${site.region}, ${site.country}`,
        email: site.email,
        phone: site.phoneText,
        whatsapp: `https://wa.me/${site.whatsapp}`,
        hours: site.hoursText,
        website: site.origin,
        faq: FAQS.map((f) => ({ ...f })),
      });
    },
  );

  server.registerTool(
    "draft_inquiry",
    {
      title: "Draft order inquiry",
      description:
        "Draft a wholesale order request for Tarigri as email text plus ready-to-click mailto: and WhatsApp links. Nothing is sent; the user must open the link and send it themselves.",
      inputSchema: {
        items: orderItems,
        buyer_name: z.string().max(200).optional(),
        company: z.string().max(200).optional(),
        destination_country: z.string().max(100).optional().describe("Country the goods ship to; Tarigri quotes shipping per destination"),
        notes: z.string().max(2000).optional().describe("e.g. OEM/private label, CE/ISO documents, samples"),
      },
      outputSchema: {
        sent: z.boolean(),
        subject: z.string(),
        body: z.string(),
        indicativeSubtotalUsd: z.number(),
        warnings: z.array(z.string()),
        mailto: z.string(),
        whatsapp: z.string(),
      },
      annotations: READ_ONLY,
    },
    async (a) => {
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
      return result({
        sent: false,
        subject,
        body,
        indicativeSubtotalUsd: quote.subtotalUsd,
        warnings: quote.notes,
        mailto: `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
        whatsapp: `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(`${subject}\n\n${body}`)}`,
      });
    },
  );
}
