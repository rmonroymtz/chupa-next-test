import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  signIn: vi.fn(),
  createAccount: vi.fn(),
  requestPasswordReset: vi.fn(),
  signOut: vi.fn(),
  getCustomer: vi.fn(),
  getRecaptchaConfig: vi.fn(),
}));
const warn = vi.hoisted(() => vi.fn());
vi.mock('@/modules/customer/infrastructure/customer.composition', () => ({
  getCustomerService: () => service,
}));
vi.mock('@/shared/observability/logger', () => ({
  getLogger: () => ({ child: () => ({ warn }) }),
}));

const {
  createAccountAction,
  getCustomerAction,
  getRecaptchaConfigAction,
  requestPasswordResetAction,
  signInAction,
  signOutAction,
} = await import('@/modules/customer/ui/customer-actions');

beforeEach(() => {
  Object.values(service).forEach((mock) => mock.mockReset());
  warn.mockReset();
});

describe('customer actions', () => {
  it('passes a valid sign-in to the service', async () => {
    service.signIn.mockResolvedValue({ status: 'invalid_credentials' });
    const input = {
      email: 'a@b.mx',
      password: ' p w ',
      guestCartId: 'guest',
      recaptchaToken: null,
    };
    await expect(signInAction(input)).resolves.toEqual({ status: 'invalid_credentials' });
    expect(service.signIn).toHaveBeenCalledWith(input);
  });

  it('rejects invalid input without reaching Magento and logs only the action name', async () => {
    const secret = 'hunter2-secret';
    await expect(
      signInAction({ email: '', password: secret, guestCartId: null, recaptchaToken: null }),
    ).resolves.toEqual({ status: 'failed' });
    await expect(createAccountAction({ email: 'a@b.mx', password: secret })).resolves.toEqual({
      status: 'failed',
    });
    await expect(requestPasswordResetAction({ email: 42 })).resolves.toEqual({ status: 'failed' });
    expect(service.signIn).not.toHaveBeenCalled();
    expect(service.createAccount).not.toHaveBeenCalled();
    expect(service.requestPasswordReset).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith({ action: 'sign_in' }, 'invalid customer action input');
    expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
  });

  it('creates an account and requests a password reset through the service', async () => {
    service.createAccount.mockResolvedValue({ status: 'created' });
    const account = {
      email: 'a@b.mx',
      firstName: 'Ana',
      lastName: 'Pérez',
      password: 'Pw1!aaaa',
      isSubscribed: false,
      recaptchaToken: 'rc',
    };
    await expect(createAccountAction(account)).resolves.toEqual({ status: 'created' });
    expect(service.createAccount).toHaveBeenCalledWith(account);

    service.requestPasswordReset.mockResolvedValue({ status: 'sent' });
    await expect(
      requestPasswordResetAction({ email: 'a@b.mx', recaptchaToken: null }),
    ).resolves.toEqual({ status: 'sent' });
  });

  it('signs out even with a bad input or a failing service', async () => {
    await expect(signOutAction({ token: 'bad token!' })).resolves.toEqual({ status: 'signed_out' });
    expect(service.signOut).not.toHaveBeenCalled();
    service.signOut.mockRejectedValue(new Error('boom'));
    await expect(signOutAction({ token: 'a.b.c' })).resolves.toEqual({ status: 'signed_out' });
  });

  it('answers a failed service with failed, and no reCAPTCHA config as null', async () => {
    service.signIn.mockRejectedValue(new Error('config'));
    await expect(
      signInAction({ email: 'a@b.mx', password: 'p', guestCartId: null, recaptchaToken: null }),
    ).resolves.toEqual({ status: 'failed' });
    service.getRecaptchaConfig.mockRejectedValue(new Error('config'));
    await expect(getRecaptchaConfigAction()).resolves.toBeNull();
  });
});

describe('getCustomerAction', () => {
  it('reads the customer for a valid token and fails closed on bad input', async () => {
    service.getCustomer.mockResolvedValue({ status: 'not_authorized' });
    await expect(getCustomerAction({ token: 'a.b.c' })).resolves.toEqual({
      status: 'not_authorized',
    });
    expect(service.getCustomer).toHaveBeenCalledWith({ token: 'a.b.c' });
    await expect(getCustomerAction({ token: 'bad token!' })).resolves.toEqual({ status: 'failed' });
    service.getCustomer.mockRejectedValue(new Error('config'));
    await expect(getCustomerAction({ token: 'a.b.c' })).resolves.toEqual({ status: 'failed' });
  });
});
