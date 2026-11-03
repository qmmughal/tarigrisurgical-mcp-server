import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerBuyerPrompts(server: McpServer) {
  server.registerPrompt(
    "source_instruments",
    {
      title: "Source instruments",
      description: "Help a buyer pick Tarigri instruments for a use case and budget, then estimate and draft the order request.",
      argsSchema: {
        need: z.string().describe("What the buyer needs, e.g. 'minor surgery kits for a vet clinic'"),
        budget_usd: z.string().optional().describe("Approximate total budget in USD"),
        destination_country: z.string().optional().describe("Where the goods ship to"),
      },
    },
    ({ need, budget_usd, destination_country }) => ({
      description: `Sourcing help for: ${need}`,
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `I'm a wholesale buyer looking for: ${need}.` +
              (budget_usd ? ` Total budget is about USD ${budget_usd}.` : "") +
              (destination_country ? ` Destination: ${destination_country}.` : "") +
              "\n\nUsing the Tarigri Surgical tools: search the catalog for suitable instruments, respect each item's MOQ, " +
              "use estimate_quote to price quantities (noting volume tiers at 50+/100+), and summarise the options. " +
              "Prices are indicative, FOB Sialkot, shipping excluded. If I like the result, use draft_inquiry to prepare " +
              "the email/WhatsApp request. Do not claim certifications (CE/ISO) beyond 'available on request'.",
          },
        },
      ],
    }),
  );
}
