import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMagentoCopyTrigger } from '@/modules/product/infrastructure/magento-copy-trigger';
import { createMagentoClient } from '@/shared/graphql/client';
import { setupMswServer } from '../../../../support/msw';
import { createCapturingObservability } from '../../../../support/observability';

const URL = 'https://magento.test/graphql';
const INPUT = { sku: '126981644035|428130345038', vendor: 'ebay' };
const server = setupMswServer();

function setup({ clientTimeoutMs = 1000, copyTimeoutMs = 100 } = {}) {
  const observability = createCapturingObservability();
  const client = createMagentoClient({
    url: URL,
    timeoutMs: clientTimeoutMs,
    storeCode: 'default',
    currency: 'MXN',
    ...observability,
  });
  const trigger = createMagentoCopyTrigger({
    client,
    timeoutMs: copyTimeoutMs,
    logger: observability.logger,
    metrics: observability.metrics,
  });
  return { trigger, ...observability };
}

describe('MagentoCopyTrigger', () => {
  it('sends processSku with sku and vendor and counts the trigger', async () => {
    let body: { operationName?: string; variables?: unknown; query?: string } = {};
    server.use(
      http.post(URL, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({
          data: { processSku: { status: 'success', message: 'queued', action: 'create' } },
        });
      }),
    );
    const { trigger, metricsNamed, logsAt } = setup();

    await trigger.trigger(INPUT);

    expect(body.operationName).toBe('generateMagentoSku');
    expect(body.query).toContain('processSku(input: { sku: $sku, vendor: $vendor })');
    expect(body.variables).toEqual(INPUT);
    expect(metricsNamed('CopyMutationTriggered')).toEqual([
      expect.objectContaining({ value: 1, dimensions: { Vendor: 'ebay' } }),
    ]);
    expect(metricsNamed('CopyMutationFailed')).toEqual([]);
    expect(logsAt('info')[0]).toMatchObject({
      sku: INPUT.sku,
      vendor: 'ebay',
      status: 'success',
      action: 'create',
    });
  });

  it('uses its own timeout and resolves when Magento is slow', async () => {
    server.use(
      http.post(URL, async () => {
        await delay(400);
        return HttpResponse.json({
          data: { processSku: { status: 'success', message: '', action: '' } },
        });
      }),
    );
    const { trigger, metricsNamed } = setup({ clientTimeoutMs: 5000, copyTimeoutMs: 50 });

    await expect(trigger.trigger(INPUT)).resolves.toBeUndefined();
    expect(metricsNamed('CopyMutationFailed')).toEqual([
      expect.objectContaining({ dimensions: { Vendor: 'ebay', Reason: 'timeout' } }),
    ]);
  });

  it.each([
    ['an HTTP error', () => new HttpResponse(null, { status: 500 }), 'http'],
    ['a GraphQL error', () => HttpResponse.json({ errors: [{ message: 'nope' }] }), 'graphql'],
    ['a network failure', () => HttpResponse.error(), 'network'],
  ])('never rejects on %s and records the failure', async (_label, resolver, reason) => {
    server.use(http.post(URL, resolver));
    const { trigger, metricsNamed, logsAt } = setup();

    await expect(trigger.trigger(INPUT)).resolves.toBeUndefined();
    expect(metricsNamed('CopyMutationFailed')).toEqual([
      expect.objectContaining({ dimensions: { Vendor: 'ebay', Reason: reason } }),
    ]);
    expect(logsAt('warn').some((line) => line.msg === 'copy mutation failed')).toBe(true);
  });

  it('never rejects even when the client throws synchronously', async () => {
    const observability = createCapturingObservability();
    const trigger = createMagentoCopyTrigger({
      client: {
        request: () => {
          throw new Error('boom');
        },
      },
      timeoutMs: 50,
      logger: observability.logger,
      metrics: observability.metrics,
    });

    await expect(trigger.trigger(INPUT)).resolves.toBeUndefined();
    expect(observability.metricsNamed('CopyMutationFailed')[0]?.dimensions.Reason).toBe('unknown');
  });
});
