'use client';

import { useEffect, useRef, useState } from 'react';
import type { AnalyticsEvent } from '@/modules/analytics/domain/analytics-event';
import { useAnalytics } from '@/modules/analytics/ui/analytics-provider.client';

interface TrackEventProps {
  readonly event: AnalyticsEvent;
  /**
   * Asked once, in the browser, right before dispatching; `false` skips the
   * event. Only a client component can pass it (a function is not serializable).
   */
  readonly shouldTrack?: () => boolean;
}

/**
 * Lets a server page report an event: dispatches it once per mount and
 * renders nothing. Give it a `key` (e.g. the query) so a page that re-renders
 * in place for a new value mounts it again and reports the new event. A full
 * page load always mounts it again: use `shouldTrack` to skip a repeat.
 */
export function TrackEvent({ event, shouldTrack }: TrackEventProps) {
  const { dispatch } = useAnalytics();
  // The event (and condition) of the first render; later renders of the same mount are ignored.
  const [mounted] = useState(() => ({ event, shouldTrack }));
  const tracked = useRef(false);

  useEffect(() => {
    // The ref survives StrictMode's effect replay, so the event is sent (or skipped) once.
    if (tracked.current) return;
    tracked.current = true;
    if (mounted.shouldTrack && !mounted.shouldTrack()) return;
    dispatch(mounted.event);
  }, [dispatch, mounted]);

  return null;
}
