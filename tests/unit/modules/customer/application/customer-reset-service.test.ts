import { describe, expect, it, vi } from 'vitest';
import type { CartGateway } from '@/modules/cart/application/ports';
import { resetPasswordInputSchema } from '@/modules/customer/application/customer-input';
import { createCustomerService } from '@/modules/customer/application/customer-service';
import { CustomerGatewayError, type CustomerGateway } from '@/modules/customer/application/ports';
import { createCapturingObservability } from '../../../../support/observability';

const COMMAND = {
  email: 'ana@example.mx',
  token: 'a1b2c3d4',
  newPassword: 'Brand-new2!',
  recaptchaToken: 'rc',
};

function setup(resetPassword: unknown) {
  const observability = createCapturingObservability();
  const service = createCustomerService({
    customerGateway: { resetPassword } as unknown as CustomerGateway,
    cartGateway: {} as unknown as CartGateway,
    logger: observability.logger,
    metrics: observability.metrics,
  });
  return { service, ...observability };
}

const fail = (kind: ConstructorParameters<typeof CustomerGatewayError>[0]) =>
  vi.fn().mockRejectedValue(new CustomerGatewayError(kind, 'boom'));

describe('customer service resetPassword', () => {
  it('resets the password with the link token', async () => {
    const resetPassword = vi.fn().mockResolvedValue(undefined);
    const { service, metricsNamed } = setup(resetPassword);
    expect(await service.resetPassword(COMMAND)).toEqual({ status: 'reset' });
    expect(resetPassword).toHaveBeenCalledWith('ana@example.mx', 'a1b2c3d4', 'Brand-new2!', 'rc');
    expect(metricsNamed('PasswordReset')[0]?.dimensions).toEqual({ Outcome: 'reset' });
  });

  it('names an invalid link, a weak password and any other failure', async () => {
    expect(await setup(fail('invalid_token')).service.resetPassword(COMMAND)).toEqual({
      status: 'invalid_token',
    });
    expect(await setup(fail('weak_password')).service.resetPassword(COMMAND)).toEqual({
      status: 'weak_password',
    });
    expect(await setup(fail('failure')).service.resetPassword(COMMAND)).toEqual({
      status: 'failed',
    });
  });

  it('never logs the email, the token or the password', async () => {
    const { service, logLines } = setup(fail('failure'));
    await service.resetPassword(COMMAND);
    expect(logLines.length).toBeGreaterThan(0);
    const text = JSON.stringify(logLines);
    for (const secret of ['ana@example.mx', 'a1b2c3d4', 'Brand-new2!']) {
      expect(text).not.toContain(secret);
    }
  });
});

describe('resetPasswordInputSchema', () => {
  it('accepts the link token, the email and a new password', () => {
    expect(resetPasswordInputSchema.safeParse(COMMAND).success).toBe(true);
    expect(resetPasswordInputSchema.safeParse({ ...COMMAND, recaptchaToken: null }).success).toBe(
      true,
    );
  });

  it('rejects a malformed token, an empty password or email, and missing fields', () => {
    expect(resetPasswordInputSchema.safeParse({ ...COMMAND, token: 'a b!' }).success).toBe(false);
    expect(resetPasswordInputSchema.safeParse({ ...COMMAND, token: '' }).success).toBe(false);
    expect(resetPasswordInputSchema.safeParse({ ...COMMAND, newPassword: '' }).success).toBe(false);
    expect(resetPasswordInputSchema.safeParse({ ...COMMAND, email: ' ' }).success).toBe(false);
    expect(resetPasswordInputSchema.safeParse({ email: COMMAND.email }).success).toBe(false);
  });
});
