import { MiniCart } from '@/modules/cart/ui/mini-cart.client';

/**
 * Cart trigger: the mini-cart island (client) reading the cart shared with
 * PWA Studio, rendered as the DS "Carrito (N)" action (icon only below
 * 1160). Its box (40px high, at least 40px wide) is the same on the server
 * and after hydration, so the header does not shift.
 */
export function CartTriggerSlot() {
  return <MiniCart />;
}
