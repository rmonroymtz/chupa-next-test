import Image from 'next/image';
import { LEGACY_ROUTES } from '@/modules/layout/domain/legacy-routes';

/**
 * T8 SLOT — cart trigger placeholder. A static link to the PWA Studio cart
 * until T8 replaces it with the mini-cart trigger (client component reading
 * the shared cart). Keep the 40×40 box so the swap causes no layout shift.
 */
export function CartTriggerSlot() {
  return (
    <a
      href={LEGACY_ROUTES.cart}
      aria-label="Carrito de compras"
      data-slot="cart-trigger"
      className="grid size-10 shrink-0 place-items-center rounded-full border border-neutral-black"
    >
      <Image src="/images/layout/cart.svg" alt="" width={24} height={20} className="h-5 w-6" />
    </a>
  );
}
