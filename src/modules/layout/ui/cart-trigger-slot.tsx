import { MiniCart } from '@/modules/cart/ui/mini-cart.client';

/**
 * Cart trigger: the mini-cart island (client) reading the cart shared with
 * PWA Studio. It keeps the 40×40 box of the static link it replaced, so the
 * header layout does not shift on hydration.
 */
export function CartTriggerSlot() {
  return <MiniCart />;
}
