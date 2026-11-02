import { describe, expect, it, vi } from 'vitest';
import type { CartGateway } from '@/modules/cart/application/ports';
import { updateProfileInputSchema } from '@/modules/customer/application/customer-input';
import { createCustomerService } from '@/modules/customer/application/customer-service';
import { CustomerGatewayError, type CustomerGateway } from '@/modules/customer/application/ports';
import { createCapturingObservability } from '../../../../support/observability';

const TOKEN = 'secret.jwt.token';
const IDENTITY = {
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@example.mx',
  password: 'Current1!',
};

function setup(
  overrides: Partial<Record<'updatePhone' | 'updateIdentity' | 'changePassword', unknown>> = {},
) {
  const gateway = {
    updatePhone: vi.fn().mockResolvedValue(undefined),
    updateIdentity: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const observability = createCapturingObservability();
  const service = createCustomerService({
    customerGateway: gateway as unknown as CustomerGateway,
    cartGateway: {} as unknown as CartGateway,
    logger: observability.logger,
    metrics: observability.metrics,
  });
  return { service, gateway, ...observability };
}

const fail = (kind: ConstructorParameters<typeof CustomerGatewayError>[0]) =>
  vi.fn().mockRejectedValue(new CustomerGatewayError(kind, 'boom'));

describe('customer service updateProfile', () => {
  it('runs the present steps in the legacy order: phone, identity, password', async () => {
    const order: string[] = [];
    const { service, gateway, metricsNamed } = setup({
      updatePhone: vi.fn(async () => void order.push('phone')),
      updateIdentity: vi.fn(async () => void order.push('identity')),
      changePassword: vi.fn(async () => void order.push('password')),
    });

    const result = await service.updateProfile({
      token: TOKEN,
      phone: '6643119682',
      identity: IDENTITY,
      password: { current: 'Current1!', next: 'Brand-new2!' },
      recaptchaToken: 'rc',
    });

    expect(result).toEqual({ status: 'saved' });
    expect(order).toEqual(['phone', 'identity', 'password']);
    expect(gateway.updatePhone).toHaveBeenCalledWith(TOKEN, '6643119682');
    expect(gateway.updateIdentity).toHaveBeenCalledWith(TOKEN, IDENTITY);
    expect(gateway.changePassword).toHaveBeenCalledWith(TOKEN, 'Current1!', 'Brand-new2!', 'rc');
    expect(metricsNamed('ProfileUpdate')[0]?.dimensions).toEqual({ Outcome: 'saved' });
  });

  it('skips the steps that are not asked for', async () => {
    const { service, gateway } = setup();
    expect(
      await service.updateProfile({ token: TOKEN, phone: '6643119682', recaptchaToken: null }),
    ).toEqual({
      status: 'saved',
    });
    expect(gateway.updateIdentity).not.toHaveBeenCalled();
    expect(gateway.changePassword).not.toHaveBeenCalled();
  });

  it('stops at the first failure and names the reason, not partial when nothing was saved', async () => {
    const { service, gateway } = setup({ updateIdentity: fail('email_taken') });
    const result = await service.updateProfile({
      token: TOKEN,
      identity: IDENTITY,
      password: { current: 'a', next: 'b' },
      recaptchaToken: null,
    });
    expect(result).toEqual({ status: 'error', reason: 'email_taken', partial: false });
    expect(gateway.changePassword).not.toHaveBeenCalled();
  });

  it('reports a partial save when an earlier step already succeeded', async () => {
    const { service } = setup({ changePassword: fail('weak_password') });
    expect(
      await service.updateProfile({
        token: TOKEN,
        phone: '1',
        password: { current: 'a', next: 'b' },
        recaptchaToken: null,
      }),
    ).toEqual({ status: 'error', reason: 'weak_password', partial: true });
  });

  it('maps wrong_password, other failures and a rejected token', async () => {
    expect(
      await setup({ updateIdentity: fail('wrong_password') }).service.updateProfile({
        token: TOKEN,
        identity: IDENTITY,
        recaptchaToken: null,
      }),
    ).toEqual({ status: 'error', reason: 'wrong_password', partial: false });
    expect(
      await setup({ updatePhone: fail('failure') }).service.updateProfile({
        token: TOKEN,
        phone: '1',
        recaptchaToken: null,
      }),
    ).toEqual({ status: 'error', reason: 'failed', partial: false });
    expect(
      await setup({ updatePhone: fail('not_authorized') }).service.updateProfile({
        token: TOKEN,
        phone: '1',
        recaptchaToken: null,
      }),
    ).toEqual({ status: 'not_authorized' });
  });

  it('never logs the token, the passwords or the email', async () => {
    const { service, logLines } = setup({ updateIdentity: fail('failure') });
    await service.updateProfile({ token: TOKEN, identity: IDENTITY, recaptchaToken: null });
    expect(logLines.length).toBeGreaterThan(0);
    const text = JSON.stringify(logLines);
    for (const secret of [TOKEN, 'Current1!', 'ana@example.mx']) expect(text).not.toContain(secret);
  });
});

describe('updateProfileInputSchema', () => {
  const base = { token: 'a.b.c', recaptchaToken: null };

  it('accepts any combination of the three groups', () => {
    expect(updateProfileInputSchema.safeParse({ ...base, phone: '6643119682' }).success).toBe(true);
    expect(updateProfileInputSchema.safeParse({ ...base, phone: '' }).success).toBe(true);
    expect(updateProfileInputSchema.safeParse({ ...base, identity: IDENTITY }).success).toBe(true);
    expect(
      updateProfileInputSchema.safeParse({
        ...base,
        identity: { ...IDENTITY, password: '' },
        password: { current: 'a', next: 'b' },
      }).success,
    ).toBe(true);
  });

  it('rejects a request with nothing to do and malformed values', () => {
    expect(updateProfileInputSchema.safeParse(base).success).toBe(false);
    expect(updateProfileInputSchema.safeParse({ ...base, phone: '12345678901' }).success).toBe(
      false,
    );
    expect(updateProfileInputSchema.safeParse({ ...base, phone: '12ab' }).success).toBe(false);
    expect(
      updateProfileInputSchema.safeParse({ ...base, identity: { ...IDENTITY, firstName: ' ' } })
        .success,
    ).toBe(false);
    expect(
      updateProfileInputSchema.safeParse({ ...base, password: { current: '', next: 'x' } }).success,
    ).toBe(false);
    expect(updateProfileInputSchema.safeParse({ phone: '1' }).success).toBe(false);
  });
});
