import { describe, it, expect, vi } from 'vitest';
import { parseCatalogSource } from '../src/services/catalogSource.js';
import { FIXTURE_SOURCE, makeService } from './fixture.js';

describe('parseCatalogSource', () => {
  it('parses the site data script', () => {
    const raw = parseCatalogSource(FIXTURE_SOURCE);
    expect(raw.PRODUCTS).toHaveLength(2);
    expect(raw.SITE.pkrPerUsd).toBe(280);
  });

  it('rejects malformed data', () => {
    expect(() => parseCatalogSource('const SITE = {}; const CATEGORIES = []; const PRODUCTS = [];')).toThrow(/unexpected shape/);
    expect(() => parseCatalogSource('syntax error here')).toThrow(/Could not evaluate/);
  });

  it('does not expose host globals to the script', () => {
    expect(() => parseCatalogSource('process.exit(1)')).toThrow();
  });
});

describe('CatalogService', () => {
  it('converts PKR to USD and normalises SKUs', async () => {
    const p = await makeService().getProduct('sc-101');
    expect(p?.sku).toBe('SC-101');
    expect(p?.unitPriceUsd).toBe(6.5);
    expect(p?.volumeTiers).toEqual([
      { minQty: 50, unitPriceUsd: 6 },
      { minQty: 100, unitPriceUsd: 5.5 },
    ]);
    expect(p?.url).toBe('https://tarigrisurgical.com/product/sc-101');
  });

  it('searches by text, category and price', async () => {
    const s = makeService();
    expect((await s.searchProducts({ query: 'needle holder' })).map((p) => p.sku)).toEqual(['NH-301']);
    expect((await s.searchProducts({ category: 'scissors' })).map((p) => p.sku)).toEqual(['SC-101']);
    expect(await s.searchProducts({ maxUnitPriceUsd: 5 })).toEqual([]);
    expect((await s.searchProducts({ featuredOnly: true })).map((p) => p.sku)).toEqual(['SC-101']);
  });

  it('applies volume tiers and flags below-MOQ lines in quotes', async () => {
    const q = await makeService().estimateQuote([
      { sku: 'SC-101', quantity: 100 },
      { sku: 'NH-301', quantity: 5 },
    ]);
    expect(q.lines[0]).toMatchObject({ unitPriceUsd: 5.5, appliedTierMinQty: 100, lineTotalUsd: 550 });
    expect(q.lines[1]).toMatchObject({ unitPriceUsd: 15.5, appliedTierMinQty: null, belowMoq: true });
    expect(q.subtotalUsd).toBe(627.5);
    expect(q.notes.join(' ')).toMatch(/below the MOQ/);
  });

  it('throws on unknown SKU', async () => {
    await expect(makeService().estimateQuote([{ sku: 'XX-999', quantity: 1 }])).rejects.toThrow(/Unknown SKU/);
  });

  it('caches within the TTL and refreshes after it', async () => {
    let t = 0;
    const fetcher = vi.fn(async () => FIXTURE_SOURCE);
    const s = makeService({ fetcher, now: () => t, ttl: 10 });
    await s.getCatalog();
    await s.getCatalog();
    expect(fetcher).toHaveBeenCalledTimes(1);
    t = 11_000;
    await s.getCatalog();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('serves stale data when a refresh fails', async () => {
    let t = 0;
    let fail = false;
    const s = makeService({
      fetcher: async () => {
        if (fail) throw new Error('network down');
        return FIXTURE_SOURCE;
      },
      now: () => t,
      ttl: 1,
    });
    await s.getCatalog();
    fail = true;
    t = 5000;
    expect((await s.getCatalog()).products).toHaveLength(2);
  });
});
