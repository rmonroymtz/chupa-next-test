import { describe, expect, it, vi } from 'vitest';
import type { PwaCartStorage } from '@/modules/cart/ui/pwa-cart-storage';
import { startSession } from '@/modules/customer/ui/start-session';

function storage(writesToken = true): PwaCartStorage {
  return {
    readCartId: vi.fn(),
    readSigninToken: vi.fn(),
    writeCartId: vi.fn().mockReturnValue(true),
    writeSigninToken: vi.fn().mockReturnValue(writesToken),
    clearSigninToken: vi.fn(),
    clearCartId: vi.fn(),
  } as unknown as PwaCartStorage;
}

const signedIn = {
  status: 'signed_in',
  token: 'jwt',
  cartId: 'customer-cart',
  customer: null,
} as const;

describe('startSession', () => {
  it('stores the token and the customer cart id', () => {
    const s = storage();
    expect(startSession(signedIn, s)).toBe(true);
    expect(s.writeSigninToken).toHaveBeenCalledWith('jwt');
    expect(s.writeCartId).toHaveBeenCalledWith('customer-cart');
    expect(s.clearCartId).not.toHaveBeenCalled();
  });

  it('forgets the guest cart id when no customer cart was created', () => {
    const s = storage();
    expect(startSession({ ...signedIn, cartId: null }, s)).toBe(true);
    expect(s.clearCartId).toHaveBeenCalled();
    expect(s.writeCartId).not.toHaveBeenCalled();
  });

  it('reports a session that could not be stored', () => {
    const s = storage(false);
    expect(startSession(signedIn, s)).toBe(false);
    expect(s.writeCartId).not.toHaveBeenCalled();
  });
});
