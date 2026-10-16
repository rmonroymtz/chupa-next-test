// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalyticsEvent } from '@/modules/analytics/domain/analytics-event';
import { AnalyticsProvider, useAnalytics } from '@/modules/analytics/ui/analytics-provider.client';
import { TrackEvent } from '@/modules/analytics/ui/track-event.client';

const SEARCH: AnalyticsEvent = { type: 'SearchRequested', query: 'taladro', store: 'amazon' };

const dataLayer = () => (window as unknown as { dataLayer: unknown[] }).dataLayer;

function DispatchOnRender({ event }: { readonly event: AnalyticsEvent }) {
  useAnalytics().dispatch(event);
  return null;
}

beforeEach(() => {
  (window as unknown as { dataLayer?: unknown[] }).dataLayer = [];
});

afterEach(() => {
  cleanup();
});

describe('AnalyticsProvider', () => {
  it('dispatches through the GTM provider to window.dataLayer', () => {
    render(
      <AnalyticsProvider>
        <DispatchOnRender event={SEARCH} />
      </AnalyticsProvider>,
    );

    expect(dataLayer()).toEqual([{ event: 'search', search_term: 'taladro', store: 'amazon' }]);
  });

  it('does not throw without GTM (no dataLayer)', () => {
    delete (window as unknown as { dataLayer?: unknown[] }).dataLayer;

    expect(() =>
      render(
        <AnalyticsProvider>
          <DispatchOnRender event={SEARCH} />
        </AnalyticsProvider>,
      ),
    ).not.toThrow();
  });

  it('uses an injected dispatcher', () => {
    const dispatch = vi.fn();
    render(
      <AnalyticsProvider dispatcher={{ dispatch }}>
        <DispatchOnRender event={SEARCH} />
      </AnalyticsProvider>,
    );

    expect(dispatch).toHaveBeenCalledWith(SEARCH);
    expect(dataLayer()).toEqual([]);
  });
});

describe('TrackEvent', () => {
  it('dispatches its event once on mount, even under StrictMode, and renders nothing', () => {
    const dispatch = vi.fn();
    const { container, rerender } = render(
      <StrictMode>
        <AnalyticsProvider dispatcher={{ dispatch }}>
          <TrackEvent event={SEARCH} />
        </AnalyticsProvider>
      </StrictMode>,
    );
    rerender(
      <StrictMode>
        <AnalyticsProvider dispatcher={{ dispatch }}>
          <TrackEvent event={{ ...SEARCH }} />
        </AnalyticsProvider>
      </StrictMode>,
    );

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(SEARCH);
    expect(container.innerHTML).toBe('');
  });

  it('pushes the mapped event to the dataLayer', () => {
    render(
      <AnalyticsProvider>
        <TrackEvent event={SEARCH} />
      </AnalyticsProvider>,
    );

    expect(dataLayer()).toEqual([{ event: 'search', search_term: 'taladro', store: 'amazon' }]);
  });

  it('asks shouldTrack once on mount and dispatches nothing when it says no', () => {
    const dispatch = vi.fn();
    const shouldTrack = vi.fn(() => false);
    render(
      <StrictMode>
        <AnalyticsProvider dispatcher={{ dispatch }}>
          <TrackEvent event={SEARCH} shouldTrack={shouldTrack} />
        </AnalyticsProvider>
      </StrictMode>,
    );

    expect(shouldTrack).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('dispatches when shouldTrack says yes', () => {
    const dispatch = vi.fn();
    render(
      <AnalyticsProvider dispatcher={{ dispatch }}>
        <TrackEvent event={SEARCH} shouldTrack={() => true} />
      </AnalyticsProvider>,
    );

    expect(dispatch).toHaveBeenCalledWith(SEARCH);
  });

  it('a new key mounts it again and reports again; the same key does not', () => {
    const dispatch = vi.fn();
    const other: AnalyticsEvent = { ...SEARCH, query: 'sierra' };
    const tree = (event: AnalyticsEvent) => (
      <AnalyticsProvider dispatcher={{ dispatch }}>
        <TrackEvent key={`${event.type}:${'query' in event ? event.query : ''}`} event={event} />
      </AnalyticsProvider>
    );
    const { rerender } = render(tree(SEARCH));
    rerender(tree({ ...SEARCH }));
    rerender(tree(other));

    expect(dispatch.mock.calls).toEqual([[SEARCH], [other]]);
  });
});
