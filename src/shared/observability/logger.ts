import pino, { type Logger } from 'pino';
import { getServerEnv } from '@/shared/config/env';

/**
 * Creates a JSON logger writing to stdout. No pretty transport is used so the
 * output stays machine-parseable in CloudWatch Logs.
 */
export function createLogger(options: { level: string; base?: Record<string, unknown> }): Logger {
  return pino({
    level: options.level,
    base: options.base ?? { service: 'chupa-storefront' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', '*.token', '*.password'],
      censor: '[redacted]',
    },
  });
}

let rootLogger: Logger | undefined;

/** Returns the process-wide logger, configured lazily from the server env. */
export function getLogger(): Logger {
  rootLogger ??= createLogger({ level: getServerEnv().LOG_LEVEL });
  return rootLogger;
}
