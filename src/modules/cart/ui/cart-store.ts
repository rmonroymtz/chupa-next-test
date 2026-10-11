import { useSyncExternalStore } from 'react';

type Listener = () => void;

let totalQuantity: number | null = null;
// Bumped on every write, even when the value is unchanged: a write is newer
// information than any read that started before it.
let writeVersion = 0;
const listeners = new Set<Listener>();

/**
 * Cart item count shared by the client islands (add to cart → header
 * trigger). Null until known. A module singleton: both islands live in the
 * same client bundle.
 *
 * Slow reads (the count on page load, the drawer contents) capture `version()`
 * before they start and write with `setIfUnchangedSince`, so a late read never
 * overwrites a newer count set by add to cart meanwhile.
 */
export const cartCountStore = {
  get: (): number | null => totalQuantity,
  version: (): number => writeVersion,
  set(next: number): void {
    writeVersion += 1;
    if (next === totalQuantity) return;
    totalQuantity = next;
    listeners.forEach((listener) => listener());
  },
  /** Writes only when nothing was written since `version` was read. */
  setIfUnchangedSince(version: number, next: number): boolean {
    if (version !== writeVersion) return false;
    cartCountStore.set(next);
    return true;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Tests only. */
  reset(): void {
    totalQuantity = null;
    writeVersion = 0;
    listeners.forEach((listener) => listener());
  },
};

const serverSnapshot = (): number | null => null;

export function useCartCount(): number | null {
  return useSyncExternalStore(cartCountStore.subscribe, cartCountStore.get, serverSnapshot);
}
