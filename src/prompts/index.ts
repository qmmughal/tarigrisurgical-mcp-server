import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListPromptsRequestSchema, GetPromptRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { getBuyerPromptDefinitions, handleGetBuyerPrompt } from "./buyerPrompts.js";

export function registerPrompts(server: Server) {
  const definitions = getBuyerPromptDefinitions();

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: definitions };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    if (!definitions.some((d) => d.name === request.params.name)) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown prompt: ${request.params.name}`);
    }
    return await handleGetBuyerPrompt(request.params.name, request.params.arguments);
  });
}
