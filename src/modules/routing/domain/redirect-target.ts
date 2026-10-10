/**
 * Target of a Magento `route()` redirect, or null when following it would not
 * move the visitor: Magento may report a positive `redirect_code` with an
 * empty `relative_url`, or with the requested url itself, and honoring either
 * would make the page redirect to itself forever.
 *
 * Urls are compared without leading slashes and with `%7C` read as `|`.
 */
export function usableRedirectTarget(
  relativeUrl: string | null | undefined,
  requestedUrl: string,
): string | null {
  const target = normalize(relativeUrl ?? '');
  if (target === '' || target === normalize(requestedUrl)) return null;
  return relativeUrl as string;
}

function normalize(url: string): string {
  return url.trim().replace(/^\/+/, '').replace(/%7c/gi, '|');
}
