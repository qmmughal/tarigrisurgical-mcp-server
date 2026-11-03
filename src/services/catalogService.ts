import { logger } from "../utils/logger.js";
import { parseCatalogSource, RawCatalog, RawProduct, SiteInfo } from "./catalogSource.js";

export interface PriceTier {
  minQty: number;
  unitPriceUsd: number;
}

export interface Product {
  sku: string;
  name: string;
  categoryId: string;
  categoryName: string;
  unit: string;
  unitPriceUsd: number;
  moq: number;
  volumeTiers: PriceTier[];
  brand?: string;
  material?: string;
  size?: string;
  description?: string;
  featured: boolean;
  url: string;
}

export interface Category {
  id: string;
  name: string;
  blurb: string;
  productCount: number;
  url: string;
}

export interface Catalog {
  site: SiteInfo;
  categories: Category[];
  products: Product[];
}

export interface QuoteLine {
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  unitPriceUsd: number;
  appliedTierMinQty: number | null;
  lineTotalUsd: number;
  belowMoq: boolean;
  moq: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotalUsd: number;
  incoterm: "FOB Sialkot";
  notes: string[];
}

export const FAQS: ReadonlyArray<{ q: string; a: string }> = [
  { q: "Where are Tarigri surgical instruments made?", a: "Tarigri Surgical Instruments manufactures stainless steel surgical, dental, orthopedic and ENT instruments in Sialkot, Punjab, Pakistan." },
  { q: "How do I order wholesale instruments from Tarigri?", a: "Browse the catalog, add items to your cart, and send an order request by email to sales@tarigrisurgical.com or WhatsApp +92 330 6669292. No payment is taken on the website. Tarigri replies with a quotation that includes shipping to your country." },
  { q: "What is the minimum order quantity?", a: "Each instrument has its own minimum order quantity, shown on the product page. Typical MOQs are 3 to 25 pieces depending on the item. Smaller trial quantities can be requested." },
  { q: "Do you offer OEM or private label?", a: "Yes. OEM and private label are available on request for export buyers." },
  { q: "Do you have CE or ISO certification?", a: "CE and ISO documentation is available on request. This website does not publish certificate numbers." },
  { q: "Which markets do you supply?", a: "Tarigri sells factory-direct wholesale to small distributors, online instrument shops, dental and veterinary clinics, and student-kit sellers in the USA, Europe and the UK, the Gulf, and Africa." },
  { q: "How are prices quoted?", a: "Catalog prices are factory-direct wholesale in US dollars, stored in Pakistani rupees at 280 PKR per USD, FOB Sialkot. Volume unit prices apply at 50+ and 100+ pieces. Shipping is quoted per destination." },
  { q: "Are the product photos exact?", a: "Product images are illustrative renderings of each instrument type. Actual finish, size and markings may differ. Request a quotation or a sample for exact specifications." },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildCatalog(raw: RawCatalog): Catalog {
  const { SITE, CATEGORIES, PRODUCTS } = raw;
  const origin = SITE.origin.replace(/\/$/, "");
  const toUsd = (pkr: number) => round2(pkr / SITE.pkrPerUsd);
  const catNames = new Map(CATEGORIES.map((c) => [c.id, c.name]));

  const products = PRODUCTS.map((p: RawProduct): Product => ({
    sku: p.id.toUpperCase(),
    name: p.name,
    categoryId: p.cat,
    categoryName: catNames.get(p.cat) ?? p.cat,
    unit: p.unit,
    unitPriceUsd: toUsd(p.price),
    moq: p.moq,
    volumeTiers: [...p.tiers]
      .sort((a, b) => a.qty - b.qty)
      .map((t) => ({ minQty: t.qty, unitPriceUsd: toUsd(t.price) })),
    brand: p.brand,
    material: p.material,
    size: p.size,
    description: p.desc,
    featured: p.featured ?? false,
    url: `${origin}/product/${p.id}`,
  }));

  const categories = CATEGORIES.map((c): Category => ({
    id: c.id,
    name: c.name,
    blurb: c.blurb,
    productCount: products.filter((p) => p.categoryId === c.id).length,
    url: `${origin}/shop?cat=${c.id}`,
  }));

  return { site: SITE, categories, products };
}

export type Fetcher = (url: string) => Promise<string>;

const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url, {
    headers: { "user-agent": "tarigri-surgical-mcp-server" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`GET ${url} failed with HTTP ${res.status}`);
  }
  return res.text();
};

export interface CatalogServiceOptions {
  origin: string;
  cacheTtlSeconds: number;
  fetcher?: Fetcher;
  now?: () => number;
}

/**
 * Read-only access to the Tarigri Surgical wholesale catalog, loaded from the
 * live site's /data.js and cached in memory.
 */
export class CatalogService {
  private cache?: { catalog: Catalog; fetchedAt: number };
  private inflight?: Promise<Catalog>;
  private readonly fetcher: Fetcher;
  private readonly now: () => number;

  constructor(private readonly options: CatalogServiceOptions) {
    this.fetcher = options.fetcher ?? defaultFetcher;
    this.now = options.now ?? Date.now;
  }

  public async getCatalog(): Promise<Catalog> {
    const ttlMs = this.options.cacheTtlSeconds * 1000;
    if (this.cache && this.now() - this.cache.fetchedAt < ttlMs) {
      return this.cache.catalog;
    }
    this.inflight ??= this.refresh().finally(() => {
      this.inflight = undefined;
    });
    try {
      return await this.inflight;
    } catch (error) {
      if (this.cache) {
        logger.warn({ error }, "Catalog refresh failed; serving stale cache");
        return this.cache.catalog;
      }
      throw error;
    }
  }

  private async refresh(): Promise<Catalog> {
    const url = `${this.options.origin.replace(/\/$/, "")}/data.js`;
    logger.debug({ url }, "Fetching catalog");
    const catalog = buildCatalog(parseCatalogSource(await this.fetcher(url)));
    this.cache = { catalog, fetchedAt: this.now() };
    return catalog;
  }

  public async searchProducts(opts: {
    query?: string;
    category?: string;
    maxUnitPriceUsd?: number;
    featuredOnly?: boolean;
    limit?: number;
  }): Promise<Product[]> {
    const { products } = await this.getCatalog();
    const terms = (opts.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const category = opts.category?.toLowerCase();

    return products
      .filter((p) => !category || p.categoryId === category || p.categoryName.toLowerCase() === category)
      .filter((p) => opts.maxUnitPriceUsd === undefined || p.unitPriceUsd <= opts.maxUnitPriceUsd)
      .filter((p) => !opts.featuredOnly || p.featured)
      .filter((p) => {
        const haystack = [p.sku, p.name, p.categoryName, p.material, p.size, p.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return terms.every((t) => haystack.includes(t));
      })
      .slice(0, opts.limit ?? 25);
  }

  public async getProduct(sku: string): Promise<Product | undefined> {
    const { products } = await this.getCatalog();
    return products.find((p) => p.sku.toLowerCase() === sku.trim().toLowerCase());
  }

  /** Indicative price estimate using the site's published MOQs and volume tiers. */
  public async estimateQuote(items: Array<{ sku: string; quantity: number }>): Promise<Quote> {
    const lines: QuoteLine[] = [];
    for (const item of items) {
      const product = await this.getProduct(item.sku);
      if (!product) {
        throw new Error(`Unknown SKU: ${item.sku}`);
      }
      const tier = [...product.volumeTiers].reverse().find((t) => item.quantity >= t.minQty);
      const unitPriceUsd = tier?.unitPriceUsd ?? product.unitPriceUsd;
      lines.push({
        sku: product.sku,
        name: product.name,
        quantity: item.quantity,
        unit: product.unit,
        unitPriceUsd,
        appliedTierMinQty: tier?.minQty ?? null,
        lineTotalUsd: round2(unitPriceUsd * item.quantity),
        belowMoq: item.quantity < product.moq,
        moq: product.moq,
      });
    }
    const notes = [
      "Indicative only: Tarigri confirms the final quotation, including shipping to your country, by email or WhatsApp.",
      "Prices are factory-direct wholesale in USD, FOB Sialkot. Shipping is not included.",
    ];
    for (const l of lines.filter((l) => l.belowMoq)) {
      notes.push(`${l.sku}: quantity ${l.quantity} is below the MOQ of ${l.moq}; smaller trial quantities must be requested from Tarigri.`);
    }
    return {
      lines,
      subtotalUsd: round2(lines.reduce((sum, l) => sum + l.lineTotalUsd, 0)),
      incoterm: "FOB Sialkot",
      notes,
    };
  }
}
