import type { AnalyticsEvent } from '@/modules/analytics/domain/analytics-event';
import type { AnalyticsDispatcher, AnalyticsProvider } from '@/modules/analytics/application/ports';

interface DispatcherOptions {
  /** Called when a provider throws or rejects; never allowed to throw itself. */
  readonly onError?: (error: unknown, event: AnalyticsEvent) => void;
}

/**
 * Fans each event out to every provider, in order. Analytics never breaks
 * the shopper flow: a failing provider is reported to `onError` and neither
 * reaches the caller nor stops the providers after it.
 */
export function createAnalyticsDispatcher(
  providers: readonly AnalyticsProvider[],
  options: DispatcherOptions = {},
): AnalyticsDispatcher {
  const report = (error: unknown, event: AnalyticsEvent): void => {
    try {
      options.onError?.(error, event);
    } catch {
      // The reporter is best effort too.
    }
  };

  return {
    dispatch(event) {
      for (const provider of providers) {
        try {
          const result = provider.handle(event);
          if (result instanceof Promise) result.catch((error: unknown) => report(error, event));
        } catch (error) {
          report(error, event);
        }
      }
    },
  };
}
