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
}

export interface PwaCartStorage {
  /** Cart id shared with PWA Studio, or null when absent or unreadable. */
  readCartId(): string | null;
  /** Writes a cart id this storefront created, in the PWA format. False when storage is unavailable. */
  writeCartId(cartId: string): boolean;
  /** Unexpired sign-in token, or null. Read-only: never written, refreshed or removed here. */
  readSigninToken(): string | null;
}

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

  return {
    readCartId: () => readString(CART_ID_KEY),
    readSigninToken: () => readString(SIGNIN_TOKEN_KEY),
    writeCartId(cartId) {
      try {
        const storage = getStorage();
        if (!storage) return false;
        storage.setItem(pwaStorageKey(CART_ID_KEY), encodePersisted(cartId, now()));
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** Adapter over `window.localStorage` (null on the server). */
export const browserCartStorage: PwaCartStorage = createPwaCartStorage(() =>
  typeof window === 'undefined' ? null : window.localStorage,
);
