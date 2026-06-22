import pino from "pino";
import { config } from "./config/env.js";

/**
 * Shared Pino logger for archive-server.
 *
 * Log level: LOG_LEVEL env var (default: "info" in production, "debug" in dev).
 * Format: JSON in production, pretty-printed in development (via pino-pretty).
 * Redacted paths: never log secrets, passwords, or auth headers.
 */
const level = config.logLevel;

export const logger = pino({
  level,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.passwordHash",
      "*.apiKey",
      "*.secret",
      "*.token",
    ],
    censor: "[REDACTED]",
  },
  // Serialize request objects for structured logging
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  base: { pid: process.pid, service: "archive-server" },
});

/**
 * Create a child logger for a specific component.
 * Usage: const log = createLogger("auth");
 */
export function createLogger(component) {
  return logger.child({ component });
}
