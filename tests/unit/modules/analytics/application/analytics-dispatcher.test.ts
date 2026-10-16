import { describe, expect, it, vi } from 'vitest';
import { createAnalyticsDispatcher } from '@/modules/analytics/application/analytics-dispatcher';
import type { AnalyticsEvent } from '@/modules/analytics/domain/analytics-event';
import type { AnalyticsProvider } from '@/modules/analytics/application/ports';

const EVENT: AnalyticsEvent = { type: 'SearchRequested', query: 'taladro', store: 'amazon' };

const recording = (): AnalyticsProvider & { events: AnalyticsEvent[] } => {
  const events: AnalyticsEvent[] = [];
  return { events, handle: (event) => void events.push(event) };
};

describe('createAnalyticsDispatcher', () => {
  it('fans each event out to every registered provider, in order', () => {
    const first = recording();
    const second = recording();

    createAnalyticsDispatcher([first, second]).dispatch(EVENT);

    expect(first.events).toEqual([EVENT]);
    expect(second.events).toEqual([EVENT]);
  });

  it('does nothing without providers', () => {
    expect(() => createAnalyticsDispatcher([]).dispatch(EVENT)).not.toThrow();
  });

  it('isolates a throwing provider: the caller never sees it and the others still run', () => {
    const onError = vi.fn();
    const after = recording();
    const failure = new Error('vendor down');
    const broken: AnalyticsProvider = {
      handle: () => {
        throw failure;
      },
    };

    expect(() =>
      createAnalyticsDispatcher([broken, after], { onError }).dispatch(EVENT),
    ).not.toThrow();
    expect(after.events).toEqual([EVENT]);
    expect(onError).toHaveBeenCalledWith(failure, EVENT);
  });

  it('isolates a rejecting asynchronous provider', async () => {
    const onError = vi.fn();
    const failure = new Error('async vendor down');
    const after = recording();
    const rejecting: AnalyticsProvider = { handle: () => Promise.reject(failure) };

    createAnalyticsDispatcher([rejecting, after], { onError }).dispatch(EVENT);
    await Promise.resolve();
    await Promise.resolve();

    expect(after.events).toEqual([EVENT]);
    expect(onError).toHaveBeenCalledWith(failure, EVENT);
  });

  it('never throws when the error reporter itself fails', () => {
    const broken: AnalyticsProvider = {
      handle: () => {
        throw new Error('vendor down');
      },
    };
    const onError = () => {
      throw new Error('reporter down');
    };

    expect(() => createAnalyticsDispatcher([broken], { onError }).dispatch(EVENT)).not.toThrow();
  });
});
