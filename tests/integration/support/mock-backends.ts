import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/** One request received by a mock backend. */
export interface RecordedCall {
  readonly service: 'magento' | 'chapi';
  /** GraphQL operation name, or the CHAPI path. */
  readonly operation: string;
  readonly body: Record<string, unknown>;
  /** Epoch ms when the request arrived. */
  readonly receivedAt: number;
  /** Epoch ms when the mock finished responding (after any delay). */
  respondedAt?: number;
}

export interface ChapiScenario {
  readonly status?: number;
  readonly body?: unknown;
  readonly delayMs?: number;
}

export interface MockBackendsConfig {
  /** `route()` payloads by url; `'outage'` answers HTTP 503. Unknown urls resolve null. */
  readonly routes: Readonly<Record<string, Record<string, unknown> | 'outage'>>;
  readonly storeConfig: Record<string, unknown>;
  /** CHAPI answers by `${store}:${sku}`; unknown keys answer an empty `data`. */
  readonly chapi: Readonly<Record<string, ChapiScenario>>;
  readonly chapiDefaultDelayMs: number;
}

export interface MockBackends {
  readonly magentoUrl: string;
  readonly chapiUrl: string;
  readonly calls: RecordedCall[];
  callsTo(service: RecordedCall['service'], operation?: string): RecordedCall[];
  reset(): void;
  close(): Promise<void>;
}

/** Starts mock Magento GraphQL and CHAPI HTTP servers that record every request. */
export async function startMockBackends(config: MockBackendsConfig): Promise<MockBackends> {
  const calls: RecordedCall[] = [];

  const magento = createServer((req, res) => {
    void handle(req, res, async (body) => {
      const operation = String(body.operationName ?? '');
      const call = record('magento', operation, body);
      const variables = (body.variables ?? {}) as Record<string, unknown>;
      let response: { status: number; body: unknown };
      if (operation === 'ProductByRoute') {
        const route = config.routes[String(variables.url)];
        response =
          route === 'outage'
            ? { status: 503, body: { message: 'Service Unavailable' } }
            : { status: 200, body: { data: { route: route ?? null } } };
      } else if (operation === 'StoreConfig') {
        response = { status: 200, body: { data: { storeConfig: config.storeConfig } } };
      } else if (operation === 'generateMagentoSku') {
        response = {
          status: 200,
          body: {
            data: { processSku: { status: 'success', message: 'queued', action: 'create' } },
          },
        };
      } else {
        response = {
          status: 400,
          body: { errors: [{ message: `Unknown operation ${operation}` }] },
        };
      }
      return { call, ...response };
    });
  });

  const chapi = createServer((req, res) => {
    void handle(req, res, async (body) => {
      const call = record('chapi', req.url ?? '', body);
      const scenario = config.chapi[`${String(body.store)}:${String(body.sku)}`];
      await delay(scenario?.delayMs ?? config.chapiDefaultDelayMs);
      return {
        call,
        status: scenario?.status ?? 200,
        body: scenario?.body ?? { vendor: body.store, status: 'ok', data: [] },
      };
    });
  });

  function record(
    service: RecordedCall['service'],
    operation: string,
    body: Record<string, unknown>,
  ) {
    const call: RecordedCall = { service, operation, body, receivedAt: Date.now() };
    calls.push(call);
    return call;
  }

  const [magentoPort, chapiPort] = await Promise.all([listen(magento), listen(chapi)]);
  return {
    magentoUrl: `http://127.0.0.1:${magentoPort}/graphql`,
    chapiUrl: `http://127.0.0.1:${chapiPort}`,
    calls,
    callsTo: (service, operation) =>
      calls.filter(
        (c) => c.service === service && (operation === undefined || c.operation === operation),
      ),
    reset: () => {
      calls.length = 0;
    },
    close: async () => {
      await Promise.all([close(magento), close(chapi)]);
    },
  };
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  respond: (
    body: Record<string, unknown>,
  ) => Promise<{ call: RecordedCall; status: number; body: unknown }>,
): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  } catch {
    // Recorded with an empty body.
  }
  const result = await respond(body);
  if (res.destroyed) return; // The client gave up (timeout).
  res.writeHead(result.status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result.body), () => {
    result.call.respondedAt = Date.now();
  });
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
}

function close(server: Server): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
