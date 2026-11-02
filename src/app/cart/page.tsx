import type { Metadata } from 'next';
import { CartPage } from '@/modules/cart/ui/cart-page.client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Carrito',
  robots: { index: false, follow: false },
};

/** The cart lives in the shopper's browser storage (PWA session): the page is a client island. */
export default function CartRoute() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8">
      <CartPage />
    </div>
  );
}
