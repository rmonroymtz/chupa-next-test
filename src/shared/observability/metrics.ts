/**
 * CloudWatch Embedded Metric Format (EMF) emitter.
 * Each call writes exactly one JSON line to stdout; the CloudWatch agent or
 * awslogs driver extracts metrics from it without any API calls.
 * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format_Specification.html
 */
import { getServerEnv } from '@/shared/config/env';

export type MetricUnit =
  | 'Seconds'
  | 'Microseconds'
  | 'Milliseconds'
  | 'Bytes'
  | 'Kilobytes'
  | 'Megabytes'
  | 'Count'
  | 'Percent'
  | 'None';

export type MetricDimensions = Readonly<Record<string, string>>;

export interface MetricInput {
  name: string;
  value: number;
  unit?: MetricUnit;
  dimensions?: MetricDimensions;
}

export interface MetricsEmitterOptions {
  namespace: string;
  /** Sink for serialized lines. Defaults to process.stdout. */
  write?: (line: string) => void;
  /** Clock in epoch milliseconds. Defaults to Date.now. */
  now?: () => number;
}

export interface MetricsEmitter {
  emitMetric(input: MetricInput): void;
  timed<T>(name: string, dimensions: MetricDimensions, operation: () => Promise<T>): Promise<T>;
}

const RESERVED_KEYS = new Set(['_aws']);

export function createMetricsEmitter(options: MetricsEmitterOptions): MetricsEmitter {
  const write = options.write ?? ((line: string) => process.stdout.write(line));
  const now = options.now ?? Date.now;

  function emitMetric({ name, value, unit = 'Count', dimensions = {} }: MetricInput): void {
    const dimensionEntries = Object.entries(dimensions).filter(
      ([key]) => !RESERVED_KEYS.has(key) && key !== name,
    );
    const record = {
      _aws: {
        Timestamp: now(),
        CloudWatchMetrics: [
          {
            Namespace: options.namespace,
            Dimensions: [dimensionEntries.map(([key]) => key)],
            Metrics: [{ Name: name, Unit: unit }],
          },
        ],
      },
      ...Object.fromEntries(dimensionEntries),
      [name]: value,
    };

    try {
      write(`${JSON.stringify(record)}\n`);
    } catch {
      // Metrics must never break request handling.
    }
  }

  async function timed<T>(
    name: string,
    dimensions: MetricDimensions,
    operation: () => Promise<T>,
  ): Promise<T> {
    const start = now();
    let outcome: 'success' | 'error' = 'error';
    try {
      const result = await operation();
      outcome = 'success';
      return result;
    } finally {
      emitMetric({
        name,
        value: now() - start,
        unit: 'Milliseconds',
        dimensions: { ...dimensions, Outcome: outcome },
      });
    }
  }

  return { emitMetric, timed };
}

let defaultEmitter: MetricsEmitter | undefined;

function getDefaultEmitter(): MetricsEmitter {
  defaultEmitter ??= createMetricsEmitter({
    namespace: getServerEnv().METRICS_NAMESPACE,
  });
  return defaultEmitter;
}

/** Emits one metric through the process-wide emitter. */
export function emitMetric(input: MetricInput): void {
  getDefaultEmitter().emitMetric(input);
}

/** Times an async operation and emits its duration in milliseconds. */
export function timed<T>(
  name: string,
  dimensions: MetricDimensions,
  operation: () => Promise<T>,
): Promise<T> {
  return getDefaultEmitter().timed(name, dimensions, operation);
}
