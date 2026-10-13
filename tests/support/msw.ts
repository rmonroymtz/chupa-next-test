import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

/**
 * Starts an MSW server for the current test file. Unhandled requests fail the
 * test so no unit test can reach a real network endpoint.
 */
export function setupMswServer() {
  const server = setupServer();
  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  return server;
}
