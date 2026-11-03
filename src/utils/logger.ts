import pino from 'pino';
import { env } from '../config/env.js';

// We route pino logs to stderr to prevent polluting stdout,
// as MCP uses stdout for its JSON-RPC communication.
export const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.NODE_ENV !== 'production' 
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          destination: 2 // 2 corresponds to stderr
        }
      }
    : undefined,
}, pino.destination(2));
