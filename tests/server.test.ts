import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, SERVER_VERSION } from '../src/server.js';
import { makeService } from './fixture.js';

let client: Client;

beforeAll(async () => {
  const server = createServer(makeService());
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

afterAll(async () => {
  await client.close();
});

describe('server metadata', () => {
  it('reports name, version and instructions', () => {
    expect(client.getServerVersion()?.name).toBe('tarigri-surgical');
    expect(client.getServerVersion()?.version).toBe(SERVER_VERSION);
    expect(client.getInstructions()).toMatch(/FOB Sialkot/);
  });

  it('keeps SERVER_VERSION in sync with package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(SERVER_VERSION).toBe(pkg.version);
  });

  it('declares tools, resources and prompts', () => {
    const caps = client.getServerCapabilities();
    expect(caps).toHaveProperty('tools');
    expect(caps).toHaveProperty('resources');
    expect(caps).toHaveProperty('prompts');
  });
});

describe('tools', () => {
  it('lists six read-only tools with titles and output schemas', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'draft_inquiry', 'estimate_quote', 'get_company_info', 'get_product', 'list_categories', 'search_products',
    ]);
    for (const t of tools) {
      expect(t.title).toBeTruthy();
      expect(t.annotations?.readOnlyHint).toBe(true);
      expect(t.outputSchema).toBeDefined();
      expect(t.inputSchema.type).toBe('object');
    }
  });

  it('search_products returns structured content matching the text', async () => {
    const res = await client.callTool({ name: 'search_products', arguments: { query: 'metzenbaum' } });
    expect(res.isError).toBeFalsy();
    const sc = res.structuredContent as { count: number; products: Array<{ sku: string }> };
    expect(sc.count).toBe(1);
    expect(sc.products[0].sku).toBe('SC-101');
    const content = res.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(content[0].text)).toEqual(sc);
  });

  it('returns isError (not a protocol error) for unknown SKU', async () => {
    const res = await client.callTool({ name: 'get_product', arguments: { sku: 'nope' } });
    expect(res.isError).toBe(true);
    expect((res.content as Array<{ text: string }>)[0].text).toMatch(/No product/);
  });

  it('rejects invalid arguments', async () => {
    const res = await client.callTool({ name: 'estimate_quote', arguments: { items: [] } }).catch((e) => e);
    expect(res instanceof Error || (res as { isError?: boolean }).isError).toBeTruthy();
  });

  it('estimate_quote applies tiers and MOQ flags', async () => {
    const res = await client.callTool({
      name: 'estimate_quote',
      arguments: { items: [{ sku: 'SC-101', quantity: 100 }, { sku: 'NH-301', quantity: 5 }] },
    });
    const sc = res.structuredContent as { subtotalUsd: number; lines: Array<{ belowMoq: boolean }> };
    expect(sc.subtotalUsd).toBe(627.5);
    expect(sc.lines[1].belowMoq).toBe(true);
  });

  it('get_company_info and list_categories work', async () => {
    const info = (await client.callTool({ name: 'get_company_info', arguments: {} })).structuredContent as { email: string; faq: unknown[] };
    expect(info.email).toBe('sales@tarigrisurgical.com');
    expect(info.faq.length).toBeGreaterThan(0);
    const cats = (await client.callTool({ name: 'list_categories', arguments: {} })).structuredContent as { categories: Array<{ id: string; productCount: number }> };
    expect(cats.categories.find((c) => c.id === 'scissors')?.productCount).toBe(1);
  });

  it('draft_inquiry builds links and never sends', async () => {
    const out = (await client.callTool({
      name: 'draft_inquiry',
      arguments: { items: [{ sku: 'SC-101', quantity: 12 }], buyer_name: 'Ann', destination_country: 'UK' },
    })).structuredContent as { sent: boolean; mailto: string; whatsapp: string; body: string };
    expect(out.sent).toBe(false);
    expect(out.mailto.startsWith('mailto:sales@tarigrisurgical.com?subject=')).toBe(true);
    expect(out.whatsapp.startsWith('https://wa.me/923306669292?text=')).toBe(true);
    expect(out.body).toContain('Destination country: UK');
  });
});

describe('resources', () => {
  it('lists the catalog and each product', async () => {
    const { resources } = await client.listResources();
    const uris = resources.map((r) => r.uri);
    expect(uris).toContain('tarigri://catalog');
    expect(uris).toContain('tarigri://product/NH-301');
  });

  it('lists the product template and reads resources', async () => {
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates[0].uriTemplate).toBe('tarigri://product/{sku}');
    const cat = await client.readResource({ uri: 'tarigri://catalog' });
    expect(JSON.parse((cat.contents[0] as { text: string }).text).products).toHaveLength(2);
    const prod = await client.readResource({ uri: 'tarigri://product/NH-301' });
    expect(JSON.parse((prod.contents[0] as { text: string }).text).sku).toBe('NH-301');
  });

  it('errors on unknown SKU', async () => {
    await expect(client.readResource({ uri: 'tarigri://product/ZZ-1' })).rejects.toThrow();
  });

  it('autocompletes SKUs', async () => {
    const res = await client.complete({
      ref: { type: 'ref/resource', uri: 'tarigri://product/{sku}' },
      argument: { name: 'sku', value: 'sc' },
    });
    expect(res.completion.values).toEqual(['SC-101']);
  });
});

describe('prompts', () => {
  it('lists and renders source_instruments', async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toEqual(['source_instruments']);
    const p = await client.getPrompt({ name: 'source_instruments', arguments: { need: 'vet kits', budget_usd: '500' } });
    const msg = p.messages[0].content as { type: string; text: string };
    expect(msg.text).toContain('vet kits');
    expect(msg.text).toContain('USD 500');
  });
});
