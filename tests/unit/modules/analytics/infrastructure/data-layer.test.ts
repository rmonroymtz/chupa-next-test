import { afterEach, describe, expect, it, vi } from 'vitest';
import { pushToDataLayer } from '@/modules/analytics/infrastructure/gtm/data-layer';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pushToDataLayer', () => {
  it('is a no-op on the server (no window)', () => {
    expect(typeof window).toBe('undefined');
    expect(() => pushToDataLayer({ event: 'search' })).not.toThrow();
  });

  it('is a no-op when GTM did not create the dataLayer', () => {
    vi.stubGlobal('window', {});
    expect(() => pushToDataLayer({ event: 'search' })).not.toThrow();
  });

  it('pushes the payload to window.dataLayer', () => {
    const dataLayer: unknown[] = [];
    vi.stubGlobal('window', { dataLayer });

    pushToDataLayer({ event: 'search', search_term: 'taladro' });

    expect(dataLayer).toEqual([{ event: 'search', search_term: 'taladro' }]);
  });

  it('never throws when the dataLayer push fails', () => {
    vi.stubGlobal('window', {
      dataLayer: {
        push: () => {
          throw new Error('broken tag');
        },
      },
    });

    expect(() => pushToDataLayer({ event: 'search' })).not.toThrow();
  });
});
