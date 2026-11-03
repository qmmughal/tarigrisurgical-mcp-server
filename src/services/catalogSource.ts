import vm from "node:vm";
import { z } from "zod";

const siteSchema = z.object({
  origin: z.string(),
  name: z.string(),
  tagline: z.string(),
  email: z.string(),
  phoneText: z.string(),
  whatsapp: z.string(),
  pkrPerUsd: z.number().positive(),
  trustLine: z.string(),
  city: z.string(),
  region: z.string(),
  country: z.string(),
  hoursText: z.string(),
});

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  blurb: z.string(),
});

const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  cat: z.string(),
  price: z.number().nonnegative(), // PKR
  moq: z.number().int().positive(),
  unit: z.string(),
  tiers: z.array(z.object({ qty: z.number().int().positive(), price: z.number().nonnegative() })).default([]),
  brand: z.string().optional(),
  material: z.string().optional(),
  size: z.string().optional(),
  desc: z.string().optional(),
  featured: z.boolean().optional(),
});

const catalogSchema = z.object({
  SITE: siteSchema,
  CATEGORIES: z.array(categorySchema),
  PRODUCTS: z.array(productSchema),
});

export type SiteInfo = z.infer<typeof siteSchema>;
export type RawCategory = z.infer<typeof categorySchema>;
export type RawProduct = z.infer<typeof productSchema>;
export type RawCatalog = z.infer<typeof catalogSchema>;

/**
 * The site publishes its catalog as a plain script (`/data.js`) declaring
 * `const SITE`, `CATEGORIES` and `PRODUCTS`. It is evaluated in an empty vm
 * context (no globals, short timeout) and the result is schema-validated.
 * Note: `vm` is not a security boundary; only point this at a site you trust.
 */
export function parseCatalogSource(source: string): RawCatalog {
  let result: unknown;
  try {
    result = vm.runInNewContext(`${source}\n;({ SITE, CATEGORIES, PRODUCTS })`, Object.create(null), {
      timeout: 1000,
    });
  } catch (error) {
    throw new Error(`Could not evaluate catalog source: ${error instanceof Error ? error.message : String(error)}`);
  }
  const parsed = catalogSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error(`Catalog data has unexpected shape: ${parsed.error.message}`);
  }
  return parsed.data;
}
