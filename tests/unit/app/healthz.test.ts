import { afterEach, describe, expect, it, vi } from 'vitest';
import * as healthz from '@/app/healthz/route';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /healthz', () => {
  it('answers 200 "ok" as uncacheable plain text', async () => {
    const response = healthz.GET();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('never calls Magento or the scraper API (liveness only)', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    healthz.GET();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('is rendered per request, never prerendered at build time', () => {
    expect(healthz.dynamic).toBe('force-dynamic');
  });
});
