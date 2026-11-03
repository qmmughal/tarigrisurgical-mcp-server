# Tarigri Surgical MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server for [tarigrisurgical.com](https://www.tarigrisurgical.com), a Sialkot (Pakistan) manufacturer of stainless steel surgical, dental, orthopedic and ENT instruments. It lets AI assistants search the wholesale catalog, price quantities and prepare an order request.

Built from [qmmughal/mcp-server-template](https://github.com/qmmughal/mcp-server-template) (TypeScript, Zod, pino, esbuild, Vitest).

## How it works

The site is a client-rendered SPA with no API, but it publishes its catalog as `/data.js`. The server fetches that file, validates it with Zod, converts the PKR prices to USD using the site's own rate (`pkrPerUsd`), and caches the result in memory (default 15 min). If a refresh fails, the last good copy is served. Nothing is ever written to the site and **no orders are placed or emails sent**.

## Tools

| Tool | Purpose |
| --- | --- |
| `search_products` | Filter by text, category, max price, best sellers |
| `get_product` | Full details for a SKU (price, MOQ, 50+/100+ tiers, material, size, URL) |
| `list_categories` | The 8 categories with product counts |
| `estimate_quote` | Indicative total for SKU + quantity lines; applies volume tiers, flags quantities below MOQ |
| `get_company_info` | Contact details, hours, ordering process, buyer FAQ |
| `draft_inquiry` | Drafts the quotation request as text plus `mailto:` and WhatsApp links for the user to send themselves |

**Resources:** `tarigri://catalog`, `tarigri://product/{sku}`
**Prompt:** `source_instruments` (guided sourcing: need, budget, destination)

All prices are factory-direct wholesale USD, FOB Sialkot; shipping is quoted separately by Tarigri.

## Setup

```bash
npm install
cp .env.example .env   # optional
npm run build          # outputs dist/index.js
npm test
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `TARIGRI_SITE_ORIGIN` | `https://tarigrisurgical.com` | Site serving `/data.js` |
| `CATALOG_CACHE_TTL_SECONDS` | `900` | Catalog cache lifetime |
| `LOG_LEVEL` | `info` | Logs go to stderr only (stdout is reserved for JSON-RPC) |

### Claude Desktop

```json
{
  "mcpServers": {
    "tarigri-surgical": {
      "command": "node",
      "args": ["D:/aiproducts/Cluade/tarigri-surgical-mcp-server/dist/index.js"],
      "env": { "NODE_ENV": "production" }
    }
  }
}
```

### Claude Code

```bash
claude mcp add tarigri-surgical -e NODE_ENV=production -- node D:/aiproducts/Cluade/tarigri-surgical-mcp-server/dist/index.js
```

## Notes

- `data.js` is evaluated in an empty `node:vm` context with a timeout, then schema-validated. `vm` is not a security sandbox, so only point `TARIGRI_SITE_ORIGIN` at a site you trust.
- Product images on the site are illustrative renderings; CE/ISO certificate numbers are not published, only "available on request". The server repeats that and never claims more.
- If the site changes the shape of `data.js`, Zod validation fails with a clear error rather than returning bad data.

## License

MIT
