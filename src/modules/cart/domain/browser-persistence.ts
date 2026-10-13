/**
 * Codec for PWA Studio's browser storage (`@magento/peregrine`
 * `lib/util/simplePersistence.js`), so both storefronts share the cart and
 * the session on the same domain.
 *
 * Stored under `M2_VENIA_BROWSER_PERSISTENCE__<name>` as
 * `JSON.stringify({ value: JSON.stringify(v), timeStored, ttl })`. An item
 * expires when `ttl` is truthy and `now - timeStored > ttl * 1000`; a falsy
 * or missing `ttl` (the cart id) never expires.
 *
 * Pure domain code: no framework imports and no I/O.
 */

const PREFIX = 'M2_VENIA_BROWSER_PERSISTENCE__';

/** Written by peregrine without ttl (`saveCartId`) and by this storefront when it creates a cart. */
export const CART_ID_KEY = 'cartId';
/** Written by peregrine with a 3600 s ttl on sign-in; this storefront only reads it. */
export const SIGNIN_TOKEN_KEY = 'signin_token';

export function pwaStorageKey(name: string): string {
  return `${PREFIX}${name}`;
}

export type DecodedItem =
  | { readonly status: 'missing' }
  | { readonly status: 'expired' }
  | { readonly status: 'malformed' }
  | { readonly status: 'ok'; readonly value: unknown };

/**
 * Serializes like peregrine `setItem`: same keys in the same order, and
 * `ttl` left out of the JSON when it is undefined.
 */
export function encodePersisted(value: unknown, now: number, ttl?: number): string {
  return JSON.stringify({ value: JSON.stringify(value), timeStored: now, ttl });
}

/**
 * Reads like peregrine `getItem`, but reports malformed data instead of
 * throwing. Never mutates storage: peregrine removes expired items itself.
 */
export function decodePersisted(raw: string | null | undefined, now: number): DecodedItem {
  if (raw === null || raw === undefined || raw === '') return { status: 'missing' };
  try {
    const envelope: unknown = JSON.parse(raw);
    if (typeof envelope !== 'object' || envelope === null || !('value' in envelope)) {
      return { status: 'malformed' };
    }
    const { value, ttl, timeStored } = envelope as Record<string, unknown>;
    if (ttl && now - Number(timeStored) > Number(ttl) * 1000) return { status: 'expired' };
    if (typeof value !== 'string') return { status: 'malformed' };
    return { status: 'ok', value: JSON.parse(value) as unknown };
  } catch {
    return { status: 'malformed' };
  }
}
