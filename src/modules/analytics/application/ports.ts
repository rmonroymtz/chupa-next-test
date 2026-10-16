import type { AnalyticsEvent } from '@/modules/analytics/domain/analytics-event';

/** An analytics vendor adapter: maps a domain event to the vendor and sends it. */
export interface AnalyticsProvider {
  handle(event: AnalyticsEvent): void | Promise<void>;
}

/** What components use to report domain events. */
export interface AnalyticsDispatcher {
  dispatch(event: AnalyticsEvent): void;
}
