'use client';

import { useEffect, useRef, useState } from 'react';
import type { AnalyticsEvent } from '@/modules/analytics/domain/analytics-event';
import { useAnalytics } from '@/modules/analytics/ui/analytics-provider.client';

interface TrackEventProps {
  readonly event: AnalyticsEvent;
}

/**
 * Lets a server page report an event: dispatches it once per mount and
 * renders nothing. Give it a `key` (e.g. the query) so a page that re-renders
 * in place for a new value mounts it again and reports the new event.
 */
export function TrackEvent({ event }: TrackEventProps) {
  const { dispatch } = useAnalytics();
  // The event of the first render; later renders of the same mount are ignored.
  const [mounted] = useState(event);
  const tracked = useRef(false);

  useEffect(() => {
    // The ref survives StrictMode's effect replay, so the event is sent once.
    if (tracked.current) return;
    tracked.current = true;
    dispatch(mounted);
  }, [dispatch, mounted]);

  return null;
}
