/** A Google Tag Manager dataLayer message. */
export type DataLayerObject = Readonly<Record<string, unknown>>;

/**
 * Pushes to `window.dataLayer` (legacy `safePush`). A no-op on the server or
 * when GTM is not loaded; a failing push never throws.
 */
export function pushToDataLayer(payload: DataLayerObject): void {
  try {
    if (typeof window === 'undefined') return;
    const { dataLayer } = window as unknown as { dataLayer?: { push(entry: unknown): unknown } };
    dataLayer?.push(payload);
  } catch {
    // Analytics never breaks the page.
  }
}
