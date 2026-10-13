import { describe, expect, it } from 'vitest';
import { encodePersisted } from '@/modules/cart/domain/browser-persistence';
import { createPwaCartStorage, type KeyValueStorage } from '@/modules/cart/ui/pwa-cart-storage';

const NOW = 1_760_000_000_000;
const CART_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__cartId';
const TOKEN_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__signin_token';

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const storage: KeyValueStorage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
  return { map, storage };
}

describe('createPwaCartStorage', () => {
  it('reads the cart id written by PWA Studio', () => {
    const { storage } = memoryStorage({ [CART_KEY]: encodePersisted('pwaCart', NOW - 5000) });
    expect(
      createPwaCartStorage(
        () => storage,
        () => NOW,
      ).readCartId(),
    ).toBe('pwaCart');
  });

  it('returns null for missing, malformed or non-string cart ids', () => {
    const now = () => NOW;
    expect(createPwaCartStorage(() => memoryStorage().storage, now).readCartId()).toBeNull();
    for (const raw of ['garbage', encodePersisted(42, NOW), encodePersisted('', NOW)]) {
      const { storage } = memoryStorage({ [CART_KEY]: raw });
      expect(createPwaCartStorage(() => storage, now).readCartId()).toBeNull();
    }
  });

  it('writes the cart id in the exact PWA format (no ttl) and never touches the token', () => {
    const token = encodePersisted('tok', NOW - 1000, 3600);
    const { map, storage } = memoryStorage({ [TOKEN_KEY]: token });
    const ok = createPwaCartStorage(
      () => storage,
      () => NOW,
    ).writeCartId('newCart');
    expect(ok).toBe(true);
    expect(map.get(CART_KEY)).toBe('{"value":"\\"newCart\\"","timeStored":1760000000000}');
    expect(map.get(TOKEN_KEY)).toBe(token);
    expect([...map.keys()].sort()).toEqual([CART_KEY, TOKEN_KEY]);
  });

  it('reads a valid sign-in token and ignores an expired one without removing it', () => {
    const valid = memoryStorage({ [TOKEN_KEY]: encodePersisted('jwt', NOW - 1000, 3600) });
    expect(
      createPwaCartStorage(
        () => valid.storage,
        () => NOW,
      ).readSigninToken(),
    ).toBe('jwt');

    const expiredRaw = encodePersisted('jwt', NOW - 3_600_001, 3600);
    const expired = memoryStorage({ [TOKEN_KEY]: expiredRaw });
    expect(
      createPwaCartStorage(
        () => expired.storage,
        () => NOW,
      ).readSigninToken(),
    ).toBeNull();
    expect(expired.map.get(TOKEN_KEY)).toBe(expiredRaw);
  });

  it('degrades to no cart when storage is unavailable or throws', () => {
    const throwing: KeyValueStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    for (const getStorage of [
      () => null,
      () => throwing,
      (): KeyValueStorage => {
        throw new Error('denied');
      },
    ]) {
      const cartStorage = createPwaCartStorage(getStorage, () => NOW);
      expect(cartStorage.readCartId()).toBeNull();
      expect(cartStorage.readSigninToken()).toBeNull();
      expect(cartStorage.writeCartId('x')).toBe(false);
    }
  });
});
