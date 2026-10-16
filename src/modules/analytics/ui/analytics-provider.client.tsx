'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { createAnalyticsDispatcher } from '@/modules/analytics/application/analytics-dispatcher';
import type { AnalyticsDispatcher } from '@/modules/analytics/application/ports';
import { gtmAnalyticsProvider } from '@/modules/analytics/infrastructure/gtm/gtm-provider';

/**
 * The storefront's providers. Cheap without GTM: the GTM provider only maps
 * the event and skips the push when `window.dataLayer` is missing.
 */
const defaultDispatcher = createAnalyticsDispatcher([gtmAnalyticsProvider]);

// Defaults to the real dispatcher so a component outside the provider still reports.
const AnalyticsContext = createContext<AnalyticsDispatcher>(defaultDispatcher);

interface AnalyticsProviderProps {
  readonly children: ReactNode;
  /** Tests only; the root layout uses the default providers. */
  readonly dispatcher?: AnalyticsDispatcher;
}

/** Makes `useAnalytics().dispatch` available to client components. */
export function AnalyticsProvider({
  children,
  dispatcher = defaultDispatcher,
}: AnalyticsProviderProps) {
  return <AnalyticsContext.Provider value={dispatcher}>{children}</AnalyticsContext.Provider>;
}

/** The dispatcher for domain analytics events; `dispatch` never throws. */
export function useAnalytics(): AnalyticsDispatcher {
  return useContext(AnalyticsContext);
}
