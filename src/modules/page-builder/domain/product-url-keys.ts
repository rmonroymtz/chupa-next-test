/**
 * Url keys of the products listed by a Page Builder `products` content type,
 * as the legacy storefront computed them: last path segment of each product
 * link, without the store's product url suffix. Order is kept (first
 * occurrence wins) so cards render in the admin's order.
 */
export function toProductUrlKeys(hrefs: readonly string[], suffix: string): string[] {
  const keys: string[] = [];
  for (const href of hrefs) {
    const key = toUrlKey(href, suffix);
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

function toUrlKey(href: string, suffix: string): string | null {
  // Drops the query, the fragment and the scheme + host (`https://host`, `//host`).
  const path = href.replace(/[?#].*$/, '').replace(/^(?:[a-z][a-z0-9+.-]*:)?\/\/[^/]*/i, '');
  const segment = path
    .split('/')
    .filter((part) => part !== '')
    .pop();
  if (!segment) return null;
  const decoded = safeDecode(segment);
  const key = suffix && decoded.endsWith(suffix) ? decoded.slice(0, -suffix.length) : decoded;
  return key === '' ? null : key;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
