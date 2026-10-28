import {
  CART_ID_KEY,
  decodePersisted,
  encodePersisted,
  pwaStorageKey,
  SIGNIN_TOKEN_KEY,
} from '@/modules/cart/domain/browser-persistence';

/** The part of `Storage` this adapter uses. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PwaCartStorage {
  /** Cart id shared with PWA Studio, or null when absent or unreadable. */
  readCartId(): string | null;
  /** Writes a cart id this storefront created, in the PWA format. False when storage is unavailable. */
  writeCartId(cartId: string): boolean;
  /** Unexpired sign-in token, or null. Never refreshed or removed by a read. */
  readSigninToken(): string | null;
  /** Writes the sign-in token like peregrine on sign-in (ttl 3600 s). False when storage is unavailable. */
  writeSigninToken(token: string): boolean;
  /** Removes the sign-in token (sign-out). False when storage is unavailable. */
  clearSigninToken(): boolean;
  /** Forgets the cart id (sign-out, like peregrine `removeCart`). False when storage is unavailable. */
  clearCartId(): boolean;
}

/** Peregrine stores the sign-in token for one hour (`asyncActions.js` `setToken`). */
export const SIGNIN_TOKEN_TTL_SECONDS = 3600;

/**
 * Browser side of the cart shared with PWA Studio. Storage may be missing or
 * throw (private mode, blocked site data): every call then degrades to "no
 * cart" instead of breaking the page.
 */
export function createPwaCartStorage(
  getStorage: () => KeyValueStorage | null,
  now: () => number = Date.now,
): PwaCartStorage {
  function readString(name: string): string | null {
    try {
      const decoded = decodePersisted(getStorage()?.getItem(pwaStorageKey(name)), now());
      return decoded.status === 'ok' && typeof decoded.value === 'string' && decoded.value !== ''
        ? decoded.value
        : null;
    } catch {
      return null;
    }
  }

  function write(name: string, value: string, ttl?: number): boolean {
    try {
      const storage = getStorage();
      if (!storage) return false;
      storage.setItem(pwaStorageKey(name), encodePersisted(value, now(), ttl));
      return true;
    } catch {
      return false;
    }
  }

  function remove(name: string): boolean {
    try {
      const storage = getStorage();
      if (!storage) return false;
      storage.removeItem(pwaStorageKey(name));
      return true;
    } catch {
      return false;
    }
  }

  return {
    readCartId: () => readString(CART_ID_KEY),
    readSigninToken: () => readString(SIGNIN_TOKEN_KEY),
    writeCartId: (cartId) => write(CART_ID_KEY, cartId),
    writeSigninToken: (token) => write(SIGNIN_TOKEN_KEY, token, SIGNIN_TOKEN_TTL_SECONDS),
    clearSigninToken: () => remove(SIGNIN_TOKEN_KEY),
    clearCartId: () => remove(CART_ID_KEY),
  };
}

/** Adapter over `window.localStorage` (null on the server). */
export const browserCartStorage: PwaCartStorage = createPwaCartStorage(() =>
  typeof window === 'undefined' ? null : window.localStorage,
);
