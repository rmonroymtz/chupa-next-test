import { describe, expect, it, vi } from 'vitest';
import { createMetricsEmitter } from '@/shared/observability/metrics';

function setup(now = 1_700_000_000_000) {
  const lines: string[] = [];
  const metrics = createMetricsEmitter({
    namespace: 'TestNamespace',
    write: (line) => lines.push(line),
    now: () => now,
  });
  const parsed = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  return { metrics, lines, parsed };
}

describe('emitMetric', () => {
  it('writes one newline-terminated EMF JSON line per call', () => {
    const { metrics, lines } = setup();

    metrics.emitMetric({ name: 'MagentoLatency', value: 42, unit: 'Milliseconds' });

    expect(lines).toHaveLength(1);
    expect(lines[0]?.endsWith('\n')).toBe(true);
    expect(lines[0]?.trimEnd()).not.toContain('\n');
  });

  it('produces the CloudWatch Embedded Metric Format structure', () => {
    const { metrics, parsed } = setup(1_234);

    metrics.emitMetric({
      name: 'PdpRender',
      value: 120,
      unit: 'Milliseconds',
      dimensions: { Route: 'pdp', Visitor: 'bot' },
    });

    expect(parsed()[0]).toEqual({
      _aws: {
        Timestamp: 1_234,
        CloudWatchMetrics: [
          {
            Namespace: 'TestNamespace',
            Dimensions: [['Route', 'Visitor']],
            Metrics: [{ Name: 'PdpRender', Unit: 'Milliseconds' }],
          },
        ],
      },
      Route: 'pdp',
      Visitor: 'bot',
      PdpRender: 120,
    });
  });

  it('defaults to unit Count and an empty dimension set', () => {
    const { metrics, parsed } = setup();

    metrics.emitMetric({ name: 'CopyMutationFailed', value: 1 });

    const [record] = parsed();
    expect(record?._aws).toMatchObject({
      CloudWatchMetrics: [
        {
          Namespace: 'TestNamespace',
          Dimensions: [[]],
          Metrics: [{ Name: 'CopyMutationFailed', Unit: 'Count' }],
        },
      ],
    });
    expect(record?.CopyMutationFailed).toBe(1);
  });

  it('never throws when the writer fails', () => {
    const metrics = createMetricsEmitter({
      namespace: 'TestNamespace',
      write: () => {
        throw new Error('stdout closed');
      },
    });

    expect(() => metrics.emitMetric({ name: 'X', value: 1 })).not.toThrow();
  });
});

describe('timed', () => {
  it('emits the elapsed milliseconds and returns the result', async () => {
    let clock = 1_000;
    const lines: string[] = [];
    const metrics = createMetricsEmitter({
      namespace: 'TestNamespace',
      write: (line) => lines.push(line),
      now: () => clock,
    });

    const result = await metrics.timed('MagentoLatency', { Operation: 'route' }, async () => {
      clock += 250;
      return 'ok';
    });

    expect(result).toBe('ok');
    const record = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    expect(record.MagentoLatency).toBe(250);
    expect(record.Operation).toBe('route');
    expect(record.Outcome).toBe('success');
  });

  it('emits with Outcome=error and rethrows when the operation fails', async () => {
    const { metrics, parsed } = setup();
    const failure = new Error('boom');

    await expect(metrics.timed('ChapiLatency', {}, () => Promise.reject(failure))).rejects.toBe(
      failure,
    );

    expect(parsed()[0]).toMatchObject({ ChapiLatency: 0, Outcome: 'error' });
  });

  it('uses the injected clock rather than wall time', async () => {
    const spy = vi.spyOn(Date, 'now');
    const { metrics } = setup();

    await metrics.timed('Op', {}, async () => undefined);

    expect(spy).not.toHaveBeenCalled();
  });
});
