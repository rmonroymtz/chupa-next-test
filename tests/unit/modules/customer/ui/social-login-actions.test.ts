import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  getButtons: vi.fn(),
  completeSignIn: vi.fn(),
  getLinkedAccounts: vi.fn(),
}));
const warn = vi.hoisted(() => vi.fn());
vi.mock('@/modules/customer/infrastructure/customer.composition', () => ({
  getSocialLoginService: () => service,
}));
vi.mock('@/shared/observability/logger', () => ({
  getLogger: () => ({ child: () => ({ warn }) }),
}));

const { completeSocialSignInAction, getLinkedSocialAccountsAction } =
  await import('@/modules/customer/ui/social-login-actions');

const TOKEN = 'social.jwt.token';

beforeEach(() => {
  Object.values(service).forEach((mock) => mock.mockReset());
  warn.mockReset();
});

describe('social login actions', () => {
  it('passes a valid social sign-in to the service', async () => {
    const signedIn = { status: 'signed_in', token: TOKEN, cartId: 'c', customer: null };
    service.completeSignIn.mockResolvedValue(signedIn);
    await expect(
      completeSocialSignInAction({ token: TOKEN, guestCartId: 'guest' }),
    ).resolves.toEqual(signedIn);
    expect(service.completeSignIn).toHaveBeenCalledWith({ token: TOKEN, guestCartId: 'guest' });
  });

  it('rejects invalid input without reaching Magento and never logs the token', async () => {
    const bad = 'bad token with spaces';
    await expect(completeSocialSignInAction({ token: bad, guestCartId: null })).resolves.toEqual({
      status: 'failed',
    });
    await expect(getLinkedSocialAccountsAction({ token: '' })).resolves.toEqual({
      status: 'failed',
    });
    expect(service.completeSignIn).not.toHaveBeenCalled();
    expect(service.getLinkedAccounts).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      { action: 'social_sign_in' },
      'invalid customer action input',
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(bad);
  });

  it('answers failed when the service throws', async () => {
    service.completeSignIn.mockRejectedValue(new Error('boom'));
    await expect(completeSocialSignInAction({ token: TOKEN, guestCartId: null })).resolves.toEqual({
      status: 'failed',
    });
    service.getLinkedAccounts.mockRejectedValue(new Error('boom'));
    await expect(getLinkedSocialAccountsAction({ token: TOKEN })).resolves.toEqual({
      status: 'failed',
    });
  });

  it('reads the linked accounts through the service', async () => {
    service.getLinkedAccounts.mockResolvedValue({ status: 'ok', accounts: [] });
    await expect(getLinkedSocialAccountsAction({ token: TOKEN })).resolves.toEqual({
      status: 'ok',
      accounts: [],
    });
    expect(service.getLinkedAccounts).toHaveBeenCalledWith({ token: TOKEN });
  });
});
