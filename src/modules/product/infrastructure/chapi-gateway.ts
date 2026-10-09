import 'server-only';
import type { Logger } from 'pino';
import type {
  ScrapedProductGateway,
  ScrapedProductQuery,
  ScraperResult,
} from '@/modules/product/application/ports';
import {
  parseSearchProductResult,
  parseVariantsResult,
} from '@/modules/product/infrastructure/chapi-mapper';
import { getServerEnv } from '@/shared/config/env';
import { defaultObservability } from '@/shared/http/observability';
import { elapsedMs, isTimeoutError } from '@/shared/http/timeout';
import type { MetricsEmitter } from '@/shared/observability/metrics';

export interface ChapiGatewayConfig {
  /** API origin without a trailing slash. */
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly logger: Logger;
  readonly metrics: MetricsEmitter;
  readonly fetch?: typeof fetch;
}

type Operation = 'product' | 'variants';

const PATHS: Record<Operation, string> = {
  product: '/api/v1/product/',
  variants: '/api/v1/product/variants/',
};

/**
 * Scraper API (CHAPI) gateway. Every call has its own timeout and resolves to
 * a {@link ScraperResult}; it never rejects. Prices are passed through as
 * returned by the API.
 */
export function createChapiGateway(config: ChapiGatewayConfig): ScrapedProductGateway {
  const fetchImpl = config.fetch ?? fetch;

  async function call<T>(
    operation: Operation,
    query: ScrapedProductQuery,
    parse: (payload: unknown) => ScraperResult<T>,
  ): Promise<ScraperResult<T>> {
    const start = performance.now();
    let status: number | undefined;
    let result: ScraperResult<T>;
    try {
      const response = await fetchImpl(`${config.baseUrl}${PATHS[operation]}`, {
        method: 'POST',
        cache: 'no-store',
        signal: AbortSignal.timeout(config.timeoutMs),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sku: query.sku, store: query.store, engine_id: query.engineId }),
      });
      status = response.status;
      result = await toResult(response, parse);
    } catch (error) {
      result = { status: 'error', reason: isTimeoutError(error) ? 'timeout' : 'http' };
      config.logger.debug({ err: error }, 'chapi request threw');
    }

    record(operation, query, result, elapsedMs(start), status);
    return result;
  }

  function record<T>(
    operation: Operation,
    query: ScrapedProductQuery,
    result: ScraperResult<T>,
    durationMs: number,
    status: number | undefined,
  ): void {
    const outcome = result.status === 'error' ? result.reason : result.status;
    config.metrics.emitMetric({
      name: 'ChapiLatency',
      value: durationMs,
      unit: 'Milliseconds',
      dimensions: { Store: query.store, Operation: operation, Outcome: outcome },
    });
    const context = { operation, store: query.store, sku: query.sku, durationMs, status };
    if (result.status === 'error') {
      config.metrics.emitMetric({
        name: 'ChapiError',
        value: 1,
        dimensions: { Store: query.store, Operation: operation, Reason: result.reason },
      });
      config.logger.warn({ ...context, reason: result.reason }, 'chapi request failed');
    } else {
      config.logger.debug({ ...context, outcome }, 'chapi request');
    }
  }

  return {
    getProduct: (query) => call('product', query, parseSearchProductResult),
    getVariants: (query) => call('variants', query, parseVariantsResult),
  };
}

async function toResult<T>(
  response: Response,
  parse: (payload: unknown) => ScraperResult<T>,
): Promise<ScraperResult<T>> {
  if (response.status === 404) {
    await response.body?.cancel();
    return { status: 'not_found' };
  }
  if (!response.ok) {
    await response.body?.cancel();
    return { status: 'error', reason: 'http' };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(await response.text());
  } catch (error) {
    if (isTimeoutError(error)) throw error;
    return { status: 'error', reason: 'invalid_response' };
  }
  return parse(payload);
}

let defaultGateway: ScrapedProductGateway | undefined;

/** Process-wide gateway configured from the server environment. */
export function getChapiGateway(): ScrapedProductGateway {
  if (!defaultGateway) {
    const env = getServerEnv();
    defaultGateway = createChapiGateway({
      baseUrl: env.CHAPI_BASE_URL,
      timeoutMs: env.CHAPI_TIMEOUT_MS,
      ...defaultObservability('chapi'),
    });
  }
  return defaultGateway;
}
