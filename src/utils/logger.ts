import pino from 'pino';
import { env } from '../config/env.js';

// Logs go to stderr (fd 2): stdout is reserved for the MCP JSON-RPC stream.
// pino-pretty runs as a worker-thread transport, which cannot be bundled, so it is opt-in
// (LOG_PRETTY=true, source/tsx runs only). pino also rejects `transport` combined with a
// destination stream, so each branch uses exactly one.
export const logger = env.LOG_PRETTY
  ? pino({
      level: env.LOG_LEVEL,
      transport: { target: 'pino-pretty', options: { colorize: true, destination: 2 } },
    })
  : pino({ level: env.LOG_LEVEL }, pino.destination(2));
