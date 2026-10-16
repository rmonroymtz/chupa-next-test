'use client';

import type { SearchRequested } from '@/modules/analytics/domain/analytics-event';
import { TrackEvent } from '@/modules/analytics/ui/track-event.client';
import { isSameSearchNavigation } from '@/modules/search/application/search-analytics';

/** Same search as the previous page (a page, sort or filter link): already reported. */
function isNewSearch(): boolean {
  return !isSameSearchNavigation(document.referrer, window.location.href);
}

/**
 * Reports the search once per (query, store): the page is a full page load
 * for every page, sort or filter link, so the referrer tells them apart.
 */
export function SearchRequestedEvent({ event }: { readonly event: SearchRequested }) {
  return <TrackEvent event={event} shouldTrack={isNewSearch} />;
}
