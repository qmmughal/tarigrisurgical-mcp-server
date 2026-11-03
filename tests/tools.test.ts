import { describe, it, expect } from 'vitest';
import { getCatalogToolDefinitions, handleCatalogTool } from '../src/tools/catalogTools.js';
import { handleReadCatalogResource, getCatalogResourceTemplates } from '../src/resources/catalogResource.js';
import { handleGetBuyerPrompt } from '../src/prompts/buyerPrompts.js';
import { makeService } from './fixture.js';

const text = (r: { content: Array<{ type: string; text?: string }> }) => JSON.parse(r.content[0].text as string);

describe('tools', () => {
  it('exposes every tool with read-only annotations', () => {
    const defs = getCatalogToolDefinitions();
    expect(defs.map((d) => d.name)).toEqual([
      'search_products', 'get_product', 'list_categories', 'estimate_quote', 'get_company_info', 'draft_inquiry',
    ]);
    expect(defs.every((d) => d.annotations?.readOnlyHint)).toBe(true);
  });

  it('search_products returns matches', async () => {
    const out = text(await handleCatalogTool('search_products', { query: 'metzenbaum' }, makeService()));
    expect(out.count).toBe(1);
    expect(out.products[0].sku).toBe('SC-101');
  });

  it('get_product errors on unknown SKU and rejects bad args', async () => {
    const s = makeService();
    await expect(handleCatalogTool('get_product', { sku: 'nope' }, s)).rejects.toThrow(/No product/);
    await expect(handleCatalogTool('get_product', {}, s)).rejects.toThrow();
  });

  it('list_categories includes product counts', async () => {
    const out = text(await handleCatalogTool('list_categories', {}, makeService()));
    expect(out.find((c: { id: string }) => c.id === 'scissors').productCount).toBe(1);
  });

  it('get_company_info returns contact and FAQ', async () => {
    const out = text(await handleCatalogTool('get_company_info', {}, makeService()));
    expect(out.email).toBe('sales@tarigrisurgical.com');
    expect(out.whatsapp).toBe('https://wa.me/923306669292');
    expect(out.faq.length).toBeGreaterThan(0);
  });

  it('draft_inquiry builds links and never sends', async () => {
    const out = text(await handleCatalogTool('draft_inquiry', {
      items: [{ sku: 'SC-101', quantity: 12 }], buyer_name: 'Ann', destination_country: 'UK',
    }, makeService()));
    expect(out.sent).toBe(false);
    expect(out.mailto.startsWith('mailto:sales@tarigrisurgical.com?subject=')).toBe(true);
    expect(out.whatsapp.startsWith('https://wa.me/923306669292?text=')).toBe(true);
    expect(out.body).toContain('SC-101');
    expect(out.body).toContain('Destination country: UK');
  });

  it('rejects unknown tools', async () => {
    await expect(handleCatalogTool('nope', {}, makeService())).rejects.toThrow(/Unknown tool/);
  });
});

describe('resources and prompts', () => {
  it('reads the catalog and a product resource', async () => {
    const s = makeService();
    const cat = JSON.parse((await handleReadCatalogResource('tarigri://catalog', s)).contents[0].text as string);
    expect(cat.products).toHaveLength(2);
    const prod = JSON.parse((await handleReadCatalogResource('tarigri://product/NH-301', s)).contents[0].text as string);
    expect(prod.sku).toBe('NH-301');
    expect(getCatalogResourceTemplates()[0].uriTemplate).toBe('tarigri://product/{sku}');
  });

  it('rejects bad resource URIs', async () => {
    await expect(handleReadCatalogResource('tarigri://product/ZZ-1', makeService())).rejects.toThrow();
  });

  it('builds the sourcing prompt', async () => {
    const p = await handleGetBuyerPrompt('source_instruments', { need: 'vet kits', budget_usd: '500' });
    expect(p.messages[0].content.text).toContain('vet kits');
    expect(p.messages[0].content.text).toContain('USD 500');
  });
});
