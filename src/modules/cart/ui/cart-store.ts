import { useSyncExternalStore } from 'react';

type Listener = () => void;

let totalQuantity: number | null = null;
const listeners = new Set<Listener>();

/**
 * Cart item count shared by the client islands (add to cart → header
 * trigger). Null until known. A module singleton: both islands live in the
 * same client bundle.
 */
export const cartCountStore = {
  get: (): number | null => totalQuantity,
  set(next: number): void {
    if (next === totalQuantity) return;
    totalQuantity = next;
    listeners.forEach((listener) => listener());
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
    listeners.forEach((listener) => listener());
  },
};

const serverSnapshot = (): number | null => null;

export function useCartCount(): number | null {
  return useSyncExternalStore(cartCountStore.subscribe, cartCountStore.get, serverSnapshot);
}
