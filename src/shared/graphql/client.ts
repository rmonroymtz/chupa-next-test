import 'server-only';
import type { Logger } from 'pino';
import { getServerEnv } from '@/shared/config/env';
import { defaultObservability } from '@/shared/http/observability';
import { elapsedMs, isTimeoutError } from '@/shared/http/timeout';
import type { MetricsEmitter } from '@/shared/observability/metrics';

export type MagentoErrorKind = 'timeout' | 'network' | 'http' | 'graphql' | 'invalid_response';

/**
 * Any failure talking to Magento. Callers must not treat it as "not found":
 * a missing entity is a successful response with null data.
 */
export class MagentoRequestError extends Error {
  override readonly name = 'MagentoRequestError';
  readonly kind: MagentoErrorKind;
  readonly operation: string;
  readonly status: number | undefined;
  readonly graphqlMessages: readonly string[];

  constructor(init: {
    kind: MagentoErrorKind;
    operation: string;
    message: string;
    status?: number;
    graphqlMessages?: readonly string[];
    cause?: unknown;
  }) {
    super(init.message, { cause: init.cause });
    this.kind = init.kind;
    this.operation = init.operation;
    this.status = init.status;
    this.graphqlMessages = init.graphqlMessages ?? [];
  }
}

export interface MagentoRequest<TVars> {
  /** Must match the operation name in `query`; used for logs and metrics. */
  readonly operationName: string;
  readonly query: string;
  readonly variables: TVars;
  /** Overrides the client timeout for this request. */
  readonly timeoutMs?: number;
  /**
   * Extra request headers (e.g. `Authorization` for a shopper's cart). Never
   * logged; they cannot replace `Store`, `Content-Currency` or the content type.
   */
  readonly headers?: Readonly<Record<string, string>>;
}

export interface MagentoClient {
  /** Resolves with `data`, or rejects with a {@link MagentoRequestError}. */
  request<TData, TVars extends Record<string, unknown> = Record<string, unknown>>(
    request: MagentoRequest<TVars>,
  ): Promise<TData>;
}

export interface MagentoClientConfig {
  readonly url: string;
  readonly timeoutMs: number;
  /** Sent as the `Store` header. */
  readonly storeCode: string;
  /** Sent as the `Content-Currency` header. */
  readonly currency: string;
  readonly logger: Logger;
  readonly metrics: MetricsEmitter;
  readonly fetch?: typeof fetch;
}

interface GraphqlPayload {
  data?: unknown;
  errors?: { message?: unknown }[];
}

export function createMagentoClient(config: MagentoClientConfig): MagentoClient {
  const fetchImpl = config.fetch ?? fetch;

  async function request<TData, TVars>(req: MagentoRequest<TVars>): Promise<TData> {
    const operation = req.operationName;
    const start = performance.now();
    try {
      const data = await execute(req);
      config.metrics.emitMetric({
        name: 'MagentoLatency',
        value: elapsedMs(start),
        unit: 'Milliseconds',
        dimensions: { Operation: operation, Outcome: 'success' },
      });
      config.logger.debug({ operation, durationMs: elapsedMs(start) }, 'magento request');
      return data as TData;
    } catch (caught) {
      const error = toMagentoError(caught, operation);
      const durationMs = elapsedMs(start);
      config.metrics.emitMetric({
        name: 'MagentoLatency',
        value: durationMs,
        unit: 'Milliseconds',
        dimensions: { Operation: operation, Outcome: error.kind },
      });
      config.metrics.emitMetric({
        name: 'MagentoError',
        value: 1,
        dimensions: { Operation: operation, Kind: error.kind },
      });
      config.logger.error(
        {
          operation,
          kind: error.kind,
          status: error.status,
          graphqlMessages: error.graphqlMessages,
          durationMs,
          err: error.cause instanceof Error ? error.cause : undefined,
        },
        'magento request failed',
      );
      throw error;
    }
  }

  async function execute<TVars>(req: MagentoRequest<TVars>): Promise<unknown> {
    const operation = req.operationName;
    const response = await fetchImpl(config.url, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(req.timeoutMs ?? config.timeoutMs),
      headers: {
        ...req.headers,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Store: config.storeCode,
        'Content-Currency': config.currency,
      },
      body: JSON.stringify({
        operationName: operation,
        query: req.query,
        variables: req.variables,
      }),
    });

    const payload = await readPayload(response);
    const messages = (payload?.errors ?? []).map((entry) =>
      String(entry.message ?? 'Unknown error'),
    );
    if (messages.length > 0) {
      throw new MagentoRequestError({
        kind: 'graphql',
        operation,
        status: response.status,
        graphqlMessages: messages,
        message: `Magento ${operation} returned GraphQL errors: ${messages.join('; ')}`,
      });
    }
    if (!response.ok) {
      throw new MagentoRequestError({
        kind: 'http',
        operation,
        status: response.status,
        message: `Magento ${operation} responded with HTTP ${response.status}`,
      });
    }
    if (payload === null || payload.data === undefined || payload.data === null) {
      throw new MagentoRequestError({
        kind: 'invalid_response',
        operation,
        status: response.status,
        message: `Magento ${operation} returned no GraphQL data`,
      });
    }
    return payload.data;
  }

  return { request };
}

/** Parses a GraphQL JSON body; returns null when the body is not one. */
async function readPayload(response: Response): Promise<GraphqlPayload | null> {
  const text = await response.text();
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as GraphqlPayload) : null;
  } catch {
    return null;
  }
}

function toMagentoError(caught: unknown, operation: string): MagentoRequestError {
  if (caught instanceof MagentoRequestError) return caught;
  if (isTimeoutError(caught)) {
    return new MagentoRequestError({
      kind: 'timeout',
      operation,
      message: `Magento ${operation} timed out`,
      cause: caught,
    });
  }
  return new MagentoRequestError({
    kind: 'network',
    operation,
    message: `Magento ${operation} request failed`,
    cause: caught,
  });
}

let defaultClient: MagentoClient | undefined;

/** Process-wide client configured from the server environment. */
export function getMagentoClient(): MagentoClient {
  if (!defaultClient) {
    const env = getServerEnv();
    defaultClient = createMagentoClient({
      url: env.MAGENTO_GRAPHQL_URL,
      timeoutMs: env.MAGENTO_TIMEOUT_MS,
      storeCode: env.MAGENTO_STORE_CODE,
      currency: env.MAGENTO_CURRENCY,
      ...defaultObservability('magento'),
    });
  }
  return defaultClient;
}

/** Typed request through the process-wide client. */
export function magentoRequest<TData, TVars extends Record<string, unknown>>(
  request: MagentoRequest<TVars>,
): Promise<TData> {
  return getMagentoClient().request<TData, TVars>(request);
}
