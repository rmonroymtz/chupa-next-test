// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchRequested } from '@/modules/analytics/domain/analytics-event';
import { AnalyticsProvider } from '@/modules/analytics/ui/analytics-provider.client';
import { SearchRequestedEvent } from '@/modules/search/ui/search-requested-event.client';

const EVENT: SearchRequested = { type: 'SearchRequested', query: 'taladro', store: 'amazon' };

function visit(path: string, referrer: string) {
  window.history.replaceState(null, '', path);
  Object.defineProperty(document, 'referrer', { value: referrer, configurable: true });
}

function mount() {
  const dispatch = vi.fn();
  render(
    <AnalyticsProvider dispatcher={{ dispatch }}>
      <SearchRequestedEvent event={EVENT} />
    </AnalyticsProvider>,
  );
  return dispatch;
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('SearchRequestedEvent', () => {
  it('reports a new search (no referrer)', () => {
    visit('/search.html?query=taladro&store=amazon&page=1', '');

    expect(mount()).toHaveBeenCalledWith(EVENT);
  });

  it('reports a search coming from another store of the same query', () => {
    visit(
      '/search.html?query=taladro&store=amazon&page=1',
      `${window.location.origin}/search.html?query=taladro&store=chupachoice`,
    );

    expect(mount()).toHaveBeenCalledWith(EVENT);
  });

  it('stays silent on a page, sort or filter link of the same search (a full page load)', () => {
    visit(
      '/search.html?query=taladro&store=amazon&page=2&storeParams=%2Fs%3Fpage%3D2',
      `${window.location.origin}/search.html?query=taladro&store=amazon&page=1`,
    );

    expect(mount()).not.toHaveBeenCalled();
  });
});
