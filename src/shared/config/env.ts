import { z } from 'zod';

/**
 * Default User-Agent substrings (case-insensitive) that identify crawlers and
 * link-preview bots. Each entry may also be a regular-expression source.
 */
export const DEFAULT_BOT_USER_AGENTS: readonly string[] = Object.freeze([
  'googlebot',
  'google-inspectiontool',
  'storebot-google',
  'bingbot',
  'yandex',
  'duckduckbot',
  'baiduspider',
  'applebot',
  'facebookexternalhit',
  'facebot',
  'twitterbot',
  'whatsapp',
  'telegrambot',
  'slackbot',
  'linkedinbot',
  'discordbot',
  'pinterest',
  'embedly',
  'skypeuripreview',
]);

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

/** Treats empty or whitespace-only values as unset so defaults apply. */
const blankAsUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const baseUrl = z.preprocess(
  blankAsUndefined,
  z.url({ protocol: /^https?$/ }).transform((value) => value.replace(/\/+$/, '')),
);

const timeoutMs = (defaultValue: number) =>
  z.preprocess(blankAsUndefined, z.coerce.number().int().positive().default(defaultValue));

const botUserAgents = z.preprocess(
  blankAsUndefined,
  z
    .string()
    .optional()
    .transform((raw): readonly string[] => {
      if (raw === undefined) return DEFAULT_BOT_USER_AGENTS;
      const entries = raw
        .split(/[,\n]/)
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0);
      return entries.length > 0 ? entries : DEFAULT_BOT_USER_AGENTS;
    }),
);

const serverEnvSchema = z.object({
  MAGENTO_GRAPHQL_URL: baseUrl,
  PUBLIC_BASE_URL: baseUrl,
  CHAPI_BASE_URL: baseUrl,
  MAGENTO_TIMEOUT_MS: timeoutMs(5000),
  CHAPI_TIMEOUT_MS: timeoutMs(15000),
  COPY_MUTATION_TIMEOUT_MS: timeoutMs(10000),
  BOT_USER_AGENTS: botUserAgents,
  LOG_LEVEL: z.preprocess(blankAsUndefined, z.enum(LOG_LEVELS).default('info')),
  METRICS_NAMESPACE: z.preprocess(
    blankAsUndefined,
    z.string().trim().min(1).default('ChupaStorefront'),
  ),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * Validates a raw environment record. Throws a single error listing every
 * invalid or missing variable.
 */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid server environment:\n${details}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/**
 * Returns the validated server environment. Parsing is deferred to first use
 * so `next build` does not require runtime variables.
 */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

/** Clears the memoized environment. Intended for tests only. */
export function resetServerEnvForTests(): void {
  cached = undefined;
}
