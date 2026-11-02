import { describe, expect, it, vi } from 'vitest';
import { CartGatewayError, type CartGateway } from '@/modules/cart/application/ports';
import { createCustomerService } from '@/modules/customer/application/customer-service';
import {
  CustomerGatewayError,
  type Customer,
  type CustomerGateway,
} from '@/modules/customer/application/ports';
import { createCapturingObservability } from '../../../../support/observability';

const TOKEN = 'secret.jwt.token';
const CUSTOMER: Customer = {
  email: 'a@b.mx',
  firstName: 'Ana',
  lastName: 'Pérez',
  isSubscribed: false,
};

function setup(overrides: Partial<CustomerGateway> = {}, cartOverrides: Partial<CartGateway> = {}) {
  const customerGateway: CustomerGateway = {
    signIn: vi.fn().mockResolvedValue(TOKEN),
    createAccount: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    getRecaptchaConfig: vi.fn().mockResolvedValue(null),
    getCustomer: vi.fn().mockResolvedValue(CUSTOMER),
    mergeCarts: vi.fn().mockResolvedValue(undefined),
    revokeToken: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  const cartGateway = {
    createEmptyCart: vi.fn().mockResolvedValue('customer-cart'),
    ...cartOverrides,
  } as unknown as CartGateway;
  const observability = createCapturingObservability();
  const service = createCustomerService({
    customerGateway,
    cartGateway,
    logger: observability.logger,
    metrics: observability.metrics,
  });
  return { service, customerGateway, cartGateway, ...observability };
}

const credentials = { email: 'a@b.mx', password: 'hunter2', recaptchaToken: 'rc' };

describe('customer service sign-in', () => {
  it('signs in, creates the customer cart, merges the guest cart and answers the customer', async () => {
    const { service, customerGateway, cartGateway, metricsNamed } = setup();
    const result = await service.signIn({ ...credentials, guestCartId: 'guest' });
    expect(result).toEqual({
      status: 'signed_in',
      token: TOKEN,
      cartId: 'customer-cart',
      customer: CUSTOMER,
    });
    expect(metricsNamed('SignIn')[0]?.dimensions).toEqual({ Outcome: 'signed_in' });
    expect(customerGateway.signIn).toHaveBeenCalledWith('a@b.mx', 'hunter2', 'rc');
    expect(cartGateway.createEmptyCart).toHaveBeenCalledWith({ signinToken: TOKEN });
    expect(customerGateway.mergeCarts).toHaveBeenCalledWith('guest', 'customer-cart', TOKEN);
  });

  it('skips the merge when there is no guest cart', async () => {
    const { service, customerGateway } = setup();
    await service.signIn({ ...credentials, guestCartId: null });
    expect(customerGateway.mergeCarts).not.toHaveBeenCalled();
  });

  it('reports invalid credentials and any other failure without a token', async () => {
    const invalid = setup({
      signIn: vi.fn().mockRejectedValue(new CustomerGatewayError('invalid_credentials', 'x')),
    });
    await expect(invalid.service.signIn({ ...credentials, guestCartId: null })).resolves.toEqual({
      status: 'invalid_credentials',
    });
    const broken = setup({ signIn: vi.fn().mockRejectedValue(new Error('boom')) });
    await expect(broken.service.signIn({ ...credentials, guestCartId: null })).resolves.toEqual({
      status: 'failed',
    });
  });

  it('stays signed in when the merge, the customer read or the cart creation fail', async () => {
    const mergeFails = setup({
      mergeCarts: vi.fn().mockRejectedValue(new CustomerGatewayError('failure', 'x')),
    });
    await expect(
      mergeFails.service.signIn({ ...credentials, guestCartId: 'g' }),
    ).resolves.toMatchObject({
      status: 'signed_in',
      cartId: 'customer-cart',
    });

    const customerFails = setup({
      getCustomer: vi.fn().mockRejectedValue(new CustomerGatewayError('failure', 'x')),
    });
    await expect(
      customerFails.service.signIn({ ...credentials, guestCartId: null }),
    ).resolves.toMatchObject({
      status: 'signed_in',
      customer: null,
    });

    const cartFails = setup(
      {},
      { createEmptyCart: vi.fn().mockRejectedValue(new CartGatewayError('failure', 'x')) },
    );
    const result = await cartFails.service.signIn({ ...credentials, guestCartId: 'g' });
    expect(result).toMatchObject({ status: 'signed_in', cartId: null });
    expect(cartFails.customerGateway.mergeCarts).not.toHaveBeenCalled();
    expect(cartFails.metricsNamed('SignIn')[0]?.dimensions).toEqual({ Outcome: 'degraded' });
    expect(mergeFails.metricsNamed('SignIn')[0]?.dimensions).toEqual({ Outcome: 'degraded' });
  });

  it('never logs the email, password or token', async () => {
    const { service, logLines } = setup({
      mergeCarts: vi.fn().mockRejectedValue(new CustomerGatewayError('failure', 'x')),
    });
    await service.signIn({ ...credentials, guestCartId: 'gc-7f3a' });
    const logged = JSON.stringify(logLines);
    for (const secret of ['hunter2', TOKEN, 'a@b.mx', 'gc-7f3a', 'customer-cart']) {
      expect(logged).not.toContain(secret);
    }
  });
});

describe('customer service account and password', () => {
  const account = {
    email: 'a@b.mx',
    firstName: 'Ana',
    lastName: 'Pérez',
    password: 'Pw1!aaaa',
    isSubscribed: true,
    recaptchaToken: 'rc',
  };

  it('creates the account and passes the reCAPTCHA token', async () => {
    const { service, customerGateway } = setup();
    await expect(service.createAccount(account)).resolves.toEqual({ status: 'created' });
    expect(customerGateway.createAccount).toHaveBeenCalledWith(
      {
        email: 'a@b.mx',
        firstName: 'Ana',
        lastName: 'Pérez',
        password: 'Pw1!aaaa',
        isSubscribed: true,
      },
      'rc',
    );
  });

  it('maps account errors to email_taken, weak_password and failed', async () => {
    for (const [kind, status] of [
      ['email_taken', 'email_taken'],
      ['weak_password', 'weak_password'],
      ['failure', 'failed'],
    ] as const) {
      const { service } = setup({
        createAccount: vi.fn().mockRejectedValue(new CustomerGatewayError(kind, 'x')),
      });
      await expect(service.createAccount(account)).resolves.toEqual({ status });
    }
  });

  it('requests a password reset and reports a failure', async () => {
    const ok = setup();
    await expect(
      ok.service.requestPasswordReset({ email: 'a@b.mx', recaptchaToken: null }),
    ).resolves.toEqual({
      status: 'sent',
    });
    const broken = setup({ requestPasswordReset: vi.fn().mockRejectedValue(new Error('x')) });
    await expect(
      broken.service.requestPasswordReset({ email: 'a@b.mx', recaptchaToken: null }),
    ).resolves.toEqual({ status: 'failed' });
  });
});

describe('customer service sign-out and config', () => {
  it('signs out even when Magento fails to revoke the token', async () => {
    const ok = setup();
    await expect(ok.service.signOut({ token: TOKEN })).resolves.toEqual({ status: 'signed_out' });
    expect(ok.customerGateway.revokeToken).toHaveBeenCalledWith(TOKEN);
    const broken = setup({ revokeToken: vi.fn().mockRejectedValue(new Error('x')) });
    await expect(broken.service.signOut({ token: TOKEN })).resolves.toEqual({
      status: 'signed_out',
    });
    const noToken = setup();
    await noToken.service.signOut({ token: null });
    expect(noToken.customerGateway.revokeToken).not.toHaveBeenCalled();
  });

  it('answers the reCAPTCHA config from the gateway', async () => {
    const config = { siteKey: 'k', badgePosition: 'bottomright', languageCode: null, forms: [] };
    const { service } = setup({ getRecaptchaConfig: vi.fn().mockResolvedValue(config) });
    await expect(service.getRecaptchaConfig()).resolves.toEqual(config);
  });
});

describe('customer service session read', () => {
  it('answers the customer for a valid token', async () => {
    const { service, customerGateway } = setup();
    await expect(service.getCustomer({ token: TOKEN })).resolves.toEqual({
      status: 'ok',
      customer: CUSTOMER,
    });
    expect(customerGateway.getCustomer).toHaveBeenCalledWith(TOKEN);
  });

  it('tells a token Magento rejects apart from a failure', async () => {
    const rejected = setup({
      getCustomer: vi.fn().mockRejectedValue(new CustomerGatewayError('not_authorized', 'x')),
    });
    await expect(rejected.service.getCustomer({ token: TOKEN })).resolves.toEqual({
      status: 'not_authorized',
    });
    const broken = setup({ getCustomer: vi.fn().mockRejectedValue(new Error('boom')) });
    await expect(broken.service.getCustomer({ token: TOKEN })).resolves.toEqual({
      status: 'failed',
    });
  });
});
