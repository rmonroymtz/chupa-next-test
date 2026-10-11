import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMagentoClient, MagentoRequestError } from '@/shared/graphql/client';
import { setupMswServer } from '../../../support/msw';
import { createCapturingObservability } from '../../../support/observability';

const URL = 'https://magento.test/graphql';
const server = setupMswServer();

function setup(timeoutMs = 200) {
  const observability = createCapturingObservability();
  const client = createMagentoClient({
    url: URL,
    timeoutMs,
    storeCode: 'default',
    currency: 'MXN',
    logger: observability.logger,
    metrics: observability.metrics,
  });
  return { client, ...observability };
}

const request = { operationName: 'Ping', query: 'query Ping { ping }', variables: { a: 1 } };

describe('createMagentoClient().request', () => {
  it('posts the operation with store and currency headers and returns data', async () => {
    let captured: { headers: Headers; body: unknown } | undefined;
    server.use(
      http.post(URL, async ({ request: req }) => {
        captured = { headers: req.headers, body: await req.json() };
        return HttpResponse.json({ data: { ping: 'pong' } });
      }),
    );
    const { client } = setup();

    const data = await client.request<{ ping: string }, { a: number }>(request);

    expect(data).toEqual({ ping: 'pong' });
    expect(captured?.headers.get('store')).toBe('default');
    expect(captured?.headers.get('content-currency')).toBe('MXN');
    expect(captured?.headers.get('content-type')).toContain('application/json');
    expect(captured?.body).toEqual({
      operationName: 'Ping',
      query: 'query Ping { ping }',
      variables: { a: 1 },
    });
  });

  it('sends extra request headers without letting them replace the store headers', async () => {
    let captured: Headers | undefined;
    server.use(
      http.post(URL, ({ request: req }) => {
        captured = req.headers;
        return HttpResponse.json({ data: { ping: 'pong' } });
      }),
    );
    const { client, logLines } = setup();

    await client.request({
      ...request,
      headers: { Authorization: 'Bearer secret-token', Store: 'other' },
    });

    expect(captured?.get('authorization')).toBe('Bearer secret-token');
    expect(captured?.get('store')).toBe('default');
    expect(JSON.stringify(logLines)).not.toContain('secret-token');
  });

  it('drops reserved headers sent by the caller in any letter case', async () => {
    let captured: Headers | undefined;
    server.use(
      http.post(URL, ({ request: req }) => {
        captured = req.headers;
        return HttpResponse.json({ data: { ping: 'pong' } });
      }),
    );
    const { client } = setup();

    await client.request({
      ...request,
      headers: {
        store: 'other',
        'CONTENT-CURRENCY': 'USD',
        'content-type': 'text/plain',
        accept: 'text/html',
        'x-trace': 'kept',
      },
    });

    expect(captured?.get('store')).toBe('default');
    expect(captured?.get('content-currency')).toBe('MXN');
    expect(captured?.get('content-type')).toBe('application/json');
    expect(captured?.get('accept')).toBe('application/json');
    expect(captured?.get('x-trace')).toBe('kept');
  });

  it('emits a latency metric per operation with a success outcome', async () => {
    server.use(http.post(URL, () => HttpResponse.json({ data: { ping: 'pong' } })));
    const { client, metricsNamed } = setup();

    await client.request(request);

    expect(metricsNamed('MagentoLatency')).toEqual([
      expect.objectContaining({
        unit: 'Milliseconds',
        dimensions: { Operation: 'Ping', Outcome: 'success' },
      }),
    ]);
    expect(metricsNamed('MagentoError')).toEqual([]);
  });

  it('throws a timeout error when Magento does not answer in time', async () => {
    server.use(
      http.post(URL, async () => {
        await delay(500);
        return HttpResponse.json({ data: {} });
      }),
    );
    const { client, metricsNamed, logsAt } = setup(50);

    const error = await client.request(request).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MagentoRequestError);
    expect(error).toMatchObject({ kind: 'timeout', operation: 'Ping' });
    expect(metricsNamed('MagentoError')).toEqual([
      expect.objectContaining({ dimensions: { Operation: 'Ping', Kind: 'timeout' } }),
    ]);
    expect(metricsNamed('MagentoLatency')[0]?.dimensions.Outcome).toBe('timeout');
    expect(logsAt('error')[0]).toMatchObject({ operation: 'Ping', kind: 'timeout' });
  });

  it('throws an http error with the status for non-2xx responses', async () => {
    server.use(http.post(URL, () => new HttpResponse('down', { status: 503 })));
    const { client } = setup();

    await expect(client.request(request)).rejects.toMatchObject({
      name: 'MagentoRequestError',
      kind: 'http',
      status: 503,
    });
  });

  it('throws a graphql error carrying the messages when errors are returned', async () => {
    server.use(
      http.post(URL, () =>
        HttpResponse.json({ data: null, errors: [{ message: 'Field "x" is not defined' }] }),
      ),
    );
    const { client } = setup();

    await expect(client.request(request)).rejects.toMatchObject({
      kind: 'graphql',
      graphqlMessages: ['Field "x" is not defined'],
    });
  });

  it('treats GraphQL errors reported with HTTP 500 as graphql errors', async () => {
    server.use(
      http.post(URL, () =>
        HttpResponse.json({ errors: [{ message: 'Syntax Error' }] }, { status: 500 }),
      ),
    );
    const { client } = setup();

    await expect(client.request(request)).rejects.toMatchObject({ kind: 'graphql', status: 500 });
  });

  it('throws invalid_response when the body is not a GraphQL payload', async () => {
    server.use(http.post(URL, () => new HttpResponse('<html>', { status: 200 })));
    const { client } = setup();

    await expect(client.request(request)).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('throws a network error when the connection fails', async () => {
    server.use(http.post(URL, () => HttpResponse.error()));
    const { client } = setup();

    await expect(client.request(request)).rejects.toMatchObject({ kind: 'network' });
  });

  it('honours a per-request timeout override', async () => {
    server.use(
      http.post(URL, async () => {
        await delay(120);
        return HttpResponse.json({ data: { ok: true } });
      }),
    );
    const { client } = setup(50);

    await expect(client.request({ ...request, timeoutMs: 1000 })).resolves.toEqual({ ok: true });
  });
});
