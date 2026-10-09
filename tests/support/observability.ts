import pino from 'pino';
import { createMetricsEmitter } from '@/shared/observability/metrics';

export interface CapturedMetric {
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly dimensions: Record<string, string>;
}

/** Logger and metrics emitter that record their output in memory. */
export function createCapturingObservability() {
  const logLines: Record<string, unknown>[] = [];
  const logger = pino(
    { level: 'trace', base: null, formatters: { level: (label) => ({ level: label }) } },
    { write: (line: string) => logLines.push(JSON.parse(line) as Record<string, unknown>) },
  );

  const metrics: CapturedMetric[] = [];
  const emitter = createMetricsEmitter({
    namespace: 'Test',
    write: (line) => {
      const record = JSON.parse(line) as {
        _aws: {
          CloudWatchMetrics: {
            Dimensions: string[][];
            Metrics: { Name: string; Unit: string }[];
          }[];
        };
      } & Record<string, unknown>;
      const [directive] = record._aws.CloudWatchMetrics;
      const [metric] = directive?.Metrics ?? [];
      if (!directive || !metric) return;
      const dimensions = Object.fromEntries(
        (directive.Dimensions[0] ?? []).map((key) => [key, String(record[key])]),
      );
      metrics.push({
        name: metric.Name,
        unit: metric.Unit,
        value: Number(record[metric.Name]),
        dimensions,
      });
    },
  });

  const metricsNamed = (name: string) => metrics.filter((metric) => metric.name === name);
  const logsAt = (level: string) => logLines.filter((line) => line.level === level);

  return { logger, metrics: emitter, logLines, capturedMetrics: metrics, metricsNamed, logsAt };
}
