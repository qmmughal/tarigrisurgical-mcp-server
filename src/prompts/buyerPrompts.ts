import { Prompt } from "@modelcontextprotocol/sdk/types.js";
import { withErrorHandling } from "../utils/errors.js";

export function getBuyerPromptDefinitions(): Prompt[] {
  return [
    {
      name: "source_instruments",
      description: "Help a buyer pick Tarigri instruments for a use case and budget, then estimate and draft the order request.",
      arguments: [
        { name: "need", description: "What the buyer needs, e.g. 'minor surgery kits for a vet clinic'", required: true },
        { name: "budget_usd", description: "Approximate total budget in USD", required: false },
        { name: "destination_country", description: "Where the goods ship to", required: false },
      ],
    },
  ];
}

export async function handleGetBuyerPrompt(name: string, args: Record<string, string> | undefined) {
  return withErrorHandling(`get_prompt:${name}`, async () => {
    const need = args?.need || "general surgical instruments";
    const budget = args?.budget_usd ? ` Total budget is about USD ${args.budget_usd}.` : "";
    const dest = args?.destination_country ? ` Destination: ${args.destination_country}.` : "";
    return {
      description: `Sourcing help for: ${need}`,
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `I'm a wholesale buyer looking for: ${need}.${budget}${dest}\n\n` +
              "Using the Tarigri Surgical tools: search the catalog for suitable instruments, respect each item's MOQ, " +
              "use estimate_quote to price quantities (noting volume tiers at 50+/100+), and summarise the options. " +
              "Prices are indicative, FOB Sialkot, shipping excluded. If I like the result, use draft_inquiry to prepare " +
              "the email/WhatsApp request. Do not claim certifications (CE/ISO) beyond 'available on request'.",
          },
        },
      ],
    };
  });
}
