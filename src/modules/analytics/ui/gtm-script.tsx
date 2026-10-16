import { getGtmContainerId } from '@/modules/analytics/infrastructure/gtm/gtm-config';
import {
  buildGtmLoaderScript,
  buildGtmNoscriptUrl,
} from '@/modules/analytics/infrastructure/gtm/gtm-snippet';

/**
 * Loads Google Tag Manager when `GTM_ID` is set; renders nothing otherwise.
 * An inline script at the top of `<body>` runs while the HTML is parsed, so
 * `window.dataLayer` exists before hydration and no early push is lost.
 */
export function GtmScript() {
  const containerId = getGtmContainerId();
  if (!containerId) return null;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: buildGtmLoaderScript(containerId) }} />
      <noscript>
        <iframe
          src={buildGtmNoscriptUrl(containerId)}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
          title="Google Tag Manager"
        />
      </noscript>
    </>
  );
}
