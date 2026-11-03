# Tarigri Surgical MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server for [tarigrisurgical.com](https://www.tarigrisurgical.com), a Sialkot (Pakistan) manufacturer of stainless steel surgical, dental, orthopedic and ENT instruments. It lets AI assistants search the wholesale catalog, price quantities and prepare an order request.

Built from [qmmughal/mcp-server-template](https://github.com/qmmughal/mcp-server-template), upgraded to the high-level `McpServer` API (SDK 1.32).

## Standards coverage

| Area | Status |
| --- | --- |
| Transports | **stdio** (local, `npx`/`node`) and **Streamable HTTP** (remote, stateless, `POST /mcp`, deployable on Vercel) |
| Protocol | Negotiated by the official TypeScript SDK (2025-06-18 and earlier) |
| Tools | 6 tools, each with `title`, JSON-Schema input, **`outputSchema` + `structuredContent`**, and annotations (`readOnlyHint`, `destructiveHint: false`, `idempotentHint`, `openWorldHint`) |
| Errors | Tool failures return `isError: true` results (not protocol errors); bad arguments are rejected by schema validation |
| Resources | Static `tarigri://catalog`, listable template `tarigri://product/{sku}` with **argument completion** |
| Prompts | `source_instruments` with typed arguments |
| Server info | `name`, `title`, `version`, `websiteUrl`, and model-facing `instructions` |
| Safety | Read-only; nothing is ordered or sent. stdout is reserved for JSON-RPC, logs go to stderr |
| Testing | 24 tests, including protocol-level tests through a real MCP `Client`; verified with the official MCP Inspector over both stdio and HTTP |
| Not implemented | Authentication (public catalog data), sessions/SSE streams (stateless by design), sampling/elicitation (not needed) |

## Tools

| Tool | Purpose |
| --- | --- |
| `search_products` | Filter by text, category, max price, best sellers |
| `get_product` | Full details for a SKU (price, MOQ, 50+/100+ tiers, material, size, URL) |
| `list_categories` | The 8 categories with product counts |
| `estimate_quote` | Indicative total for SKU + quantity lines; applies volume tiers, flags quantities below MOQ |
| `get_company_info` | Contact details, hours, buyer FAQ |
| `draft_inquiry` | Drafts the quotation request as text plus `mailto:` and WhatsApp links for the user to send themselves |

All prices are factory-direct wholesale USD, FOB Sialkot; shipping is quoted separately by Tarigri.

## How it works

The site is a client-rendered SPA with no API, but it publishes its catalog as `/data.js`. The server fetches it, validates it with Zod, converts PKR prices to USD using the site's own rate, and caches it in memory (default 15 min, stale copy served if a refresh fails).

## Run locally

```bash
npm install
npm run build        # dist/index.js (single bundled executable with shebang)
npm test
npm run inspect      # opens the official MCP Inspector against the build
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `TARIGRI_SITE_ORIGIN` | `https://tarigrisurgical.com` | Site serving `/data.js` |
| `CATALOG_CACHE_TTL_SECONDS` | `900` | Catalog cache lifetime |
| `LOG_LEVEL` | `info` | Logs go to stderr only |
| `LOG_PRETTY` | `false` | Pretty logs when running from source with tsx (not the bundle) |

## Deploy to Vercel (remote server)

The repo is Vercel-ready: `api/mcp.ts` is the function, `/mcp` is rewritten to it, and `public/index.html` is a landing page with copy-paste configs.

1. Vercel dashboard → **Add New → Project** → import `qmmughal/tarigrisurgical-mcp-server` (or run `npx vercel login && npx vercel --prod`).
2. Keep the defaults (`vercel.json` sets the framework and output directory). No env vars are required.
3. Optional: add a domain such as `mcp.tarigrisurgical.com` under Project → Domains.

Your endpoint is then `https://<your-domain>/mcp`. The endpoint is public and unauthenticated by design (it only exposes the public catalog). Add Vercel's WAF/rate limiting if you expect heavy traffic.

## Connect from AI tools

Replace `<URL>` with your Vercel endpoint (`https://…/mcp`). Until the package is published to npm, use the local `node` form with the absolute path to `dist/index.js` instead of `npx`.

**Claude Code**
```bash
claude mcp add --transport http tarigri-surgical <URL>
# or local: claude mcp add tarigri-surgical -- node /abs/path/dist/index.js
```

**Claude Desktop**: *Settings → Connectors → Add custom connector* with `<URL>`, or `claude_desktop_config.json`:
```json
{ "mcpServers": { "tarigri-surgical": { "command": "node", "args": ["/abs/path/dist/index.js"] } } }
```

**Cursor** (`.cursor/mcp.json`)
```json
{ "mcpServers": { "tarigri-surgical": { "url": "<URL>" } } }
```

**VS Code / GitHub Copilot** (`.vscode/mcp.json`)
```json
{ "servers": { "tarigri-surgical": { "type": "http", "url": "<URL>" } } }
```

**Windsurf** (`~/.codeium/windsurf/mcp_config.json`)
```json
{ "mcpServers": { "tarigri-surgical": { "serverUrl": "<URL>" } } }
```

**Gemini CLI** (`~/.gemini/settings.json`)
```json
{ "mcpServers": { "tarigri-surgical": { "httpUrl": "<URL>" } } }
```

**Codex CLI** (`~/.codex/config.toml`)
```toml
[mcp_servers.tarigri-surgical]
command = "node"
args = ["/abs/path/dist/index.js"]
```

**Any client that only supports stdio**: `npx -y mcp-remote <URL>`.

## Notes

- `data.js` is evaluated in an empty `node:vm` context with a timeout, then schema-validated. `vm` is not a security sandbox, so only point `TARIGRI_SITE_ORIGIN` at a site you trust.
- Product images on the site are illustrative; CE/ISO certificate numbers are not published, only "available on request". The server never claims more.
- If the site changes the shape of `data.js`, validation fails with a clear error rather than returning bad data.

## License

MIT
