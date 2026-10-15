import 'server-only';
import type { Logger } from 'pino';
import type {
  ChapiSearchQuery,
  ChapiSearchResult,
  ChapiSortQuery,
  SearchGateway,
} from '@/modules/search/application/ports';
import {
  parseSearchResponse,
  parseSortResponse,
} from '@/modules/search/infrastructure/chapi-search-mapper';
import { getServerEnv } from '@/shared/config/env';
import { defaultObservability } from '@/shared/http/observability';
import { elapsedMs, isTimeoutError } from '@/shared/http/timeout';
import type { MetricsEmitter } from '@/shared/observability/metrics';

export interface ChapiSearchGatewayConfig {
  /** API origin without a trailing slash. */
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly logger: Logger;
  readonly metrics: MetricsEmitter;
  /** Vendors product urls route (`PRODUCT_VENDORS`); card links use one of them. */
  readonly vendors: readonly string[];
  readonly fetch?: typeof fetch;
}

type Operation = 'search' | 'search_sort';

const PATHS: Record<Operation, string> = {
  search: '/api/v1/search/',
  search_sort: '/api/v1/search/sort_by',
};

/** `ChapiError` reasons, shared with the product gateway's dashboards. */
const ERROR_REASONS = { timeout: 'timeout', error: 'http', invalid: 'invalid_response' } as const;

/**
 * CHAPI search gateway, mirroring the product gateway: each call has its own
 * timeout, emits `ChapiLatency` (and `ChapiError` on failure) and resolves
 * to a {@link ChapiSearchResult}; it never rejects. Responses come gzip
 * encoded; `fetch` decompresses them.
 */
export function createChapiSearchGateway(config: ChapiSearchGatewayConfig): SearchGateway {
  const fetchImpl = config.fetch ?? fetch;

  async function call<T>(
    operation: Operation,
    store: string,
    body: Record<string, unknown>,
    parse: (payload: unknown) => ChapiSearchResult<T>,
  ): Promise<ChapiSearchResult<T>> {
    const start = performance.now();
    let status: number | undefined;
    let result: ChapiSearchResult<T>;
    try {
      const response = await fetchImpl(`${config.baseUrl}${PATHS[operation]}`, {
        method: 'POST',
        cache: 'no-store',
        signal: AbortSignal.timeout(config.timeoutMs),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      status = response.status;
      result = await toResult(response, parse);
    } catch (error) {
      result = { status: isTimeoutError(error) ? 'timeout' : 'error' };
      config.logger.debug({ err: error }, 'chapi search request threw');
    }

    record(operation, store, result, elapsedMs(start), status);
    return result;
  }

  function record(
    operation: Operation,
    store: string,
    result: ChapiSearchResult<unknown>,
    durationMs: number,
    status: number | undefined,
  ): void {
    config.metrics.emitMetric({
      name: 'ChapiLatency',
      value: durationMs,
      unit: 'Milliseconds',
      dimensions: { Store: store, Operation: operation, Outcome: result.status },
    });
    const context = { operation, store, durationMs, status };
    if (result.status === 'ok') {
      config.logger.debug({ ...context, outcome: 'ok' }, 'chapi search request');
      return;
    }
    const reason = ERROR_REASONS[result.status];
    config.metrics.emitMetric({
      name: 'ChapiError',
      value: 1,
      dimensions: { Store: store, Operation: operation, Reason: reason },
    });
    config.logger.warn({ ...context, reason }, 'chapi search request failed');
  }

  return {
    async search(query: ChapiSearchQuery) {
      const result = await call(
        'search',
        query.store,
        {
          filters: query.filters,
          query: query.query,
          store: query.store,
          engine_id: query.engineId,
          page_size: query.pageSize,
        },
        (payload) =>
          parseSearchResponse(payload, { requestedStore: query.store, vendors: config.vendors }),
      );
      if (result.status === 'ok' && result.data.skippedItems > 0) {
        const { skippedItems } = result.data;
        config.metrics.emitMetric({
          name: 'ChapiSearchSkippedItems',
          value: skippedItems,
          dimensions: { Store: query.store },
        });
        config.logger.warn({ store: query.store, skippedItems }, 'chapi search items skipped');
      }
      return result;
    },
    sortOptions: (query: ChapiSortQuery) =>
      call(
        'search_sort',
        query.store,
        {
          store: query.store,
          query: query.query,
          engine_id: query.engineId,
          filters: query.filters,
          max_results: query.maxResults,
        },
        parseSortResponse,
      ),
  };
}

async function toResult<T>(
  response: Response,
  parse: (payload: unknown) => ChapiSearchResult<T>,
): Promise<ChapiSearchResult<T>> {
  if (!response.ok) {
    await response.body?.cancel();
    return { status: 'error' };
  }
  // A body-read failure (timeout, connection reset, broken gzip stream) is
  // rethrown and classified like a fetch failure; only an unparseable or
  // unusable body is `invalid`.
  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return { status: 'invalid' };
  }
  return parse(payload);
}

let defaultGateway: SearchGateway | undefined;

/** Process-wide gateway configured from the server environment (holds no data). */
export function getChapiSearchGateway(): SearchGateway {
  if (!defaultGateway) {
    const env = getServerEnv();
    defaultGateway = createChapiSearchGateway({
      baseUrl: env.CHAPI_BASE_URL,
      timeoutMs: env.CHAPI_SEARCH_TIMEOUT_MS,
      vendors: env.PRODUCT_VENDORS,
      ...defaultObservability('chapi-search'),
    });
  }
  return defaultGateway;
}
