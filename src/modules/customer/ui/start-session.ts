import type { SignInResult } from '@/modules/customer/application/customer-service';
import { browserCartStorage, type PwaCartStorage } from '@/modules/cart/ui/pwa-cart-storage';

/**
 * Stores a successful sign-in the way peregrine does, so the PWA reads the
 * same session: the token (ttl 3600 s) and the customer's cart id. Without a
 * customer cart the old guest cart id is dropped: Magento rejects it for a
 * signed-in shopper, and the next add-to-cart creates a cart.
 * False when browser storage is unavailable: the shopper would not stay signed in.
 */
export function startSession(
  result: Extract<SignInResult, { status: 'signed_in' }>,
  storage: PwaCartStorage = browserCartStorage,
): boolean {
  if (!storage.writeSigninToken(result.token)) return false;
  if (result.cartId) storage.writeCartId(result.cartId);
  else storage.clearCartId();
  return true;
}
