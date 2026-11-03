import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "./logger.js";
import { z } from "zod";

/**
 * Validates arguments against a Zod schema and throws a standard McpError if invalid.
 */
export function validateArgs<T>(schema: z.ZodSchema<T>, args: unknown): T {
  const result = schema.safeParse(args);
  if (!result.success) {
    logger.warn({ error: result.error.format(), args }, "Invalid arguments provided");
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid parameters: ${result.error.message}`
    );
  }
  return result.data;
}

/**
 * Wraps an async function with standard MCP error handling.
 */
export async function withErrorHandling<T>(
  operationName: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.error({ error, operationName }, "Operation failed");
    if (error instanceof McpError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    throw new McpError(ErrorCode.InternalError, `[${operationName}] Failed: ${message}`);
  }
}
