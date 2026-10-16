import type { AnalyticsProvider } from '@/modules/analytics/application/ports';
import { pushToDataLayer } from '@/modules/analytics/infrastructure/gtm/data-layer';
import { toDataLayerObject } from '@/modules/analytics/infrastructure/gtm/gtm-mappers';

/** Sends domain events to Google Tag Manager through `window.dataLayer`. */
export const gtmAnalyticsProvider: AnalyticsProvider = {
  handle(event) {
    const payload = toDataLayerObject(event);
    if (payload) pushToDataLayer(payload);
  },
};
