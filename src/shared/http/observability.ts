import type { Logger } from 'pino';
import { getLogger } from '@/shared/observability/logger';
import { emitMetric, timed, type MetricsEmitter } from '@/shared/observability/metrics';

/** Logging and metrics dependencies injected into outbound adapters. */
export interface AdapterObservability {
  readonly logger: Logger;
  readonly metrics: MetricsEmitter;
}

/** Process-wide logger (child bound to `component`) and EMF emitter. */
export function defaultObservability(component: string): AdapterObservability {
  return { logger: getLogger().child({ component }), metrics: { emitMetric, timed } };
}
