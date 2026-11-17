import { describe, expect, it, vi } from 'vitest';
import type { CartGateway } from '@/modules/cart/application/ports';
import {
  CustomerGatewayError,
  type Customer,
  type CustomerGateway,
  type SocialLoginGateway,
} from '@/modules/customer/application/ports';
import { createSocialLoginService } from '@/modules/customer/application/social-login-service';
import { createCapturingObservability } from '../../../../support/observability';

const TOKEN = 'social.jwt.token';
const CUSTOMER: Customer = {
  email: 'a@b.mx',
  firstName: 'Ana',
  lastName: 'Pérez',
  isSubscribed: false,
};
const GOOGLE = { type: 'google', label: 'Google', url: 'https://m.test/login?type=google' };

function setup(
  overrides: Partial<CustomerGateway> = {},
  socialOverrides: Partial<SocialLoginGateway> = {},
  cartOverrides: Partial<CartGateway> = {},
  options: { now?: () => number; configTtlMs?: number; configTimeoutMs?: number } = {},
) {
  const customerGateway = {
    getCustomer: vi.fn().mockResolvedValue(CUSTOMER),
    mergeCarts: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as CustomerGateway;
  const socialLoginGateway: SocialLoginGateway = {
    getConfig: vi
      .fn()
      .mockResolvedValue({ enabled: true, positions: ['popup'], buttons: [GOOGLE] }),
    getLinkedAccounts: vi.fn().mockResolvedValue([]),
    ...socialOverrides,
  };
  const cartGateway = {
    createEmptyCart: vi.fn().mockResolvedValue('customer-cart'),
    ...cartOverrides,
  } as unknown as CartGateway;
  const observability = createCapturingObservability();
  const service = createSocialLoginService({
    customerGateway,
    cartGateway,
    socialLoginGateway,
    logger: observability.logger,
    metrics: observability.metrics,
    ...options,
  });
  return { service, customerGateway, cartGateway, socialLoginGateway, ...observability };
}

describe('social login service buttons', () => {
  it('answers the buttons when Amasty is enabled for the popup position', async () => {
    await expect(setup().service.getButtons()).resolves.toEqual([GOOGLE]);
  });

  it('answers no buttons when disabled, without the popup position, empty or unreadable', async () => {
    const disabled = setup(
      {},
      {
        getConfig: vi
          .fn()
          .mockResolvedValue({ enabled: false, positions: ['popup'], buttons: [GOOGLE] }),
      },
    );
    await expect(disabled.service.getButtons()).resolves.toEqual([]);
    const cartOnly = setup(
      {},
      {
        getConfig: vi
          .fn()
          .mockResolvedValue({ enabled: true, positions: ['checkout_cart'], buttons: [GOOGLE] }),
      },
    );
    await expect(cartOnly.service.getButtons()).resolves.toEqual([]);
    const unreadable = setup({}, { getConfig: vi.fn().mockResolvedValue(null) });
    await expect(unreadable.service.getButtons()).resolves.toEqual([]);
    const throwing = setup({}, { getConfig: vi.fn().mockRejectedValue(new Error('boom')) });
    await expect(throwing.service.getButtons()).resolves.toEqual([]);
  });
});

describe('social login service config cache', () => {
  const ENABLED = { enabled: true, positions: ['popup'], buttons: [GOOGLE] };

  it('reads Magento once per ttl, then again once it expires', async () => {
    let clock = 0;
    const getConfig = vi.fn().mockResolvedValue(ENABLED);
    const { service } = setup({}, { getConfig }, {}, { now: () => clock, configTtlMs: 1000 });
    await service.getButtons();
    clock = 999;
    await expect(service.getButtons()).resolves.toEqual([GOOGLE]);
    expect(getConfig).toHaveBeenCalledTimes(1);
    clock = 1001;
    await service.getButtons();
    expect(getConfig).toHaveBeenCalledTimes(2);
  });

  it('shares one Magento read between concurrent renders', async () => {
    const getConfig = vi.fn().mockResolvedValue(ENABLED);
    const { service } = setup({}, { getConfig });
    await Promise.all([service.getButtons(), service.getButtons(), service.getButtons()]);
    expect(getConfig).toHaveBeenCalledTimes(1);
  });

  it('keeps the last good config when a later read fails', async () => {
    let clock = 0;
    const getConfig = vi.fn().mockResolvedValueOnce(ENABLED).mockResolvedValue(null);
    const { service } = setup({}, { getConfig }, {}, { now: () => clock, configTtlMs: 1000 });
    await service.getButtons();
    clock = 5000;
    await expect(service.getButtons()).resolves.toEqual([GOOGLE]);
    expect(getConfig).toHaveBeenCalledTimes(2);
  });

  it('serves an expired config at once and refreshes it in the background', async () => {
    let clock = 0;
    const getConfig = vi
      .fn()
      .mockResolvedValueOnce(ENABLED)
      .mockReturnValue(new Promise(() => undefined));
    const { service } = setup(
      {},
      { getConfig },
      {},
      { now: () => clock, configTtlMs: 1000, configTimeoutMs: 60_000 },
    );
    await service.getButtons();
    clock = 5000;
    // A hanging refresh would hold this render for the whole time budget.
    await expect(service.getButtons()).resolves.toEqual([GOOGLE]);
    expect(getConfig).toHaveBeenCalledTimes(2);
  });

  it('does not hold the page for a slow Magento, and the late answer serves the next render', async () => {
    let finish: (config: typeof ENABLED) => void = () => undefined;
    const getConfig = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { service } = setup({}, { getConfig }, {}, { configTimeoutMs: 10 });
    await expect(service.getButtons()).resolves.toEqual([]);
    finish(ENABLED);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(service.getButtons()).resolves.toEqual([GOOGLE]);
    expect(getConfig).toHaveBeenCalledTimes(1);
  });
});

describe('social login service sign-in', () => {
  it('checks the token, creates the customer cart and merges the guest cart', async () => {
    const { service, customerGateway, cartGateway, metricsNamed } = setup();
    await expect(service.completeSignIn({ token: TOKEN, guestCartId: 'guest' })).resolves.toEqual({
      status: 'signed_in',
      token: TOKEN,
      cartId: 'customer-cart',
      customer: CUSTOMER,
    });
    expect(customerGateway.getCustomer).toHaveBeenCalledWith(TOKEN);
    expect(cartGateway.createEmptyCart).toHaveBeenCalledWith({ signinToken: TOKEN });
    expect(customerGateway.mergeCarts).toHaveBeenCalledWith('guest', 'customer-cart', TOKEN);
    expect(metricsNamed('SocialSignIn')[0]?.dimensions).toEqual({ Outcome: 'signed_in' });
  });

  it('skips the merge without a guest cart', async () => {
    const { service, customerGateway } = setup();
    await service.completeSignIn({ token: TOKEN, guestCartId: null });
    expect(customerGateway.mergeCarts).not.toHaveBeenCalled();
  });

  it('rejects a token Magento does not accept, without creating a cart', async () => {
    const { service, cartGateway, metricsNamed } = setup({
      getCustomer: vi.fn().mockRejectedValue(new CustomerGatewayError('not_authorized', 'x')),
    });
    await expect(service.completeSignIn({ token: TOKEN, guestCartId: 'guest' })).resolves.toEqual({
      status: 'failed',
    });
    expect(cartGateway.createEmptyCart).not.toHaveBeenCalled();
    expect(metricsNamed('SocialSignIn')[0]?.dimensions).toEqual({ Outcome: 'not_authorized' });
  });

  it('fails when the token cannot be checked', async () => {
    const { service, cartGateway } = setup({
      getCustomer: vi.fn().mockRejectedValue(new CustomerGatewayError('failure', 'x')),
    });
    await expect(service.completeSignIn({ token: TOKEN, guestCartId: null })).resolves.toEqual({
      status: 'failed',
    });
    expect(cartGateway.createEmptyCart).not.toHaveBeenCalled();
  });

  it('stays signed in, degraded, when the cart or the merge fail', async () => {
    const mergeFails = setup({
      mergeCarts: vi.fn().mockRejectedValue(new CustomerGatewayError('failure', 'x')),
    });
    await expect(
      mergeFails.service.completeSignIn({ token: TOKEN, guestCartId: 'guest' }),
    ).resolves.toMatchObject({ status: 'signed_in', cartId: 'customer-cart' });
    expect(mergeFails.metricsNamed('SocialSignIn')[0]?.dimensions).toEqual({ Outcome: 'degraded' });

    const cartFails = setup({}, {}, { createEmptyCart: vi.fn().mockRejectedValue(new Error('x')) });
    await expect(
      cartFails.service.completeSignIn({ token: TOKEN, guestCartId: 'guest' }),
    ).resolves.toMatchObject({ status: 'signed_in', cartId: null });
    expect(cartFails.customerGateway.mergeCarts).not.toHaveBeenCalled();
  });

  it('never logs the token', async () => {
    const { service, logLines } = setup({
      getCustomer: vi.fn().mockRejectedValue(new CustomerGatewayError('not_authorized', 'x')),
    });
    await service.completeSignIn({ token: TOKEN, guestCartId: 'guest' });
    expect(JSON.stringify(logLines)).not.toContain(TOKEN);
  });
});

describe('social login service linked accounts', () => {
  it('answers the linked accounts', async () => {
    const { service, socialLoginGateway } = setup(
      {},
      { getLinkedAccounts: vi.fn().mockResolvedValue([{ type: 'google', name: 'Google' }]) },
    );
    await expect(service.getLinkedAccounts({ token: TOKEN })).resolves.toEqual({
      status: 'ok',
      accounts: [{ type: 'google', name: 'Google' }],
    });
    expect(socialLoginGateway.getLinkedAccounts).toHaveBeenCalledWith(TOKEN);
  });

  it('answers not_authorized and failed', async () => {
    const rejected = setup(
      {},
      {
        getLinkedAccounts: vi
          .fn()
          .mockRejectedValue(new CustomerGatewayError('not_authorized', 'x')),
      },
    );
    await expect(rejected.service.getLinkedAccounts({ token: TOKEN })).resolves.toEqual({
      status: 'not_authorized',
    });
    const broken = setup({}, { getLinkedAccounts: vi.fn().mockRejectedValue(new Error('x')) });
    await expect(broken.service.getLinkedAccounts({ token: TOKEN })).resolves.toEqual({
      status: 'failed',
    });
  });
});
