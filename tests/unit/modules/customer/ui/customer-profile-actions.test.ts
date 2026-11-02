import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  resetPassword: vi.fn(),
}));
const warn = vi.hoisted(() => vi.fn());
vi.mock('@/modules/customer/infrastructure/customer.composition', () => ({
  getCustomerService: () => service,
}));
vi.mock('@/shared/observability/logger', () => ({
  getLogger: () => ({ child: () => ({ warn }) }),
}));

const { getCustomerProfileAction, resetPasswordAction, updateProfileAction } =
  await import('@/modules/customer/ui/customer-actions');

beforeEach(() => {
  service.getProfile.mockReset();
  service.updateProfile.mockReset();
  service.resetPassword.mockReset();
  warn.mockReset();
});

describe('getCustomerProfileAction', () => {
  it('passes the token to the service', async () => {
    service.getProfile.mockResolvedValue({ status: 'ok', profile: {} });
    await expect(getCustomerProfileAction({ token: 'a.b.c' })).resolves.toEqual({
      status: 'ok',
      profile: {},
    });
    expect(service.getProfile).toHaveBeenCalledWith({ token: 'a.b.c' });
  });

  it('rejects an invalid input without reaching Magento and logs only the action name', async () => {
    await expect(getCustomerProfileAction({ token: '' })).resolves.toEqual({ status: 'failed' });
    expect(service.getProfile).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      { action: 'get_customer_profile' },
      'invalid customer action input',
    );
  });

  it('answers failed when the service cannot be built', async () => {
    service.getProfile.mockRejectedValue(new Error('MAGENTO_GRAPHQL_URL is not set'));
    await expect(getCustomerProfileAction({ token: 'a.b.c' })).resolves.toEqual({
      status: 'failed',
    });
  });
});

describe('updateProfileAction', () => {
  const input = { token: 'a.b.c', phone: '6643119682', recaptchaToken: null };

  it('passes the validated input to the service', async () => {
    service.updateProfile.mockResolvedValue({ status: 'saved' });
    await expect(updateProfileAction(input)).resolves.toEqual({ status: 'saved' });
    expect(service.updateProfile).toHaveBeenCalledWith(input);
  });

  it('rejects an invalid input without reaching Magento and logs only the action name', async () => {
    await expect(updateProfileAction({ token: 'a.b.c', recaptchaToken: null })).resolves.toEqual({
      status: 'error',
      reason: 'failed',
      partial: false,
    });
    expect(service.updateProfile).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      { action: 'update_profile' },
      'invalid customer action input',
    );
  });

  it('answers a failed error when the service cannot be built', async () => {
    service.updateProfile.mockRejectedValue(new Error('MAGENTO_GRAPHQL_URL is not set'));
    await expect(updateProfileAction(input)).resolves.toEqual({
      status: 'error',
      reason: 'failed',
      partial: false,
    });
  });
});

describe('resetPasswordAction', () => {
  const input = {
    email: 'ana@example.mx',
    token: 'a1b2c3d4',
    newPassword: 'Brand-new2!',
    recaptchaToken: null,
  };

  it('passes the validated input to the service', async () => {
    service.resetPassword.mockResolvedValue({ status: 'reset' });
    await expect(resetPasswordAction(input)).resolves.toEqual({ status: 'reset' });
    expect(service.resetPassword).toHaveBeenCalledWith(input);
  });

  it('rejects an invalid input without reaching Magento and logs only the action name', async () => {
    await expect(resetPasswordAction({ ...input, token: '' })).resolves.toEqual({
      status: 'failed',
    });
    expect(service.resetPassword).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      { action: 'reset_password' },
      'invalid customer action input',
    );
  });

  it('answers failed when the service cannot be built', async () => {
    service.resetPassword.mockRejectedValue(new Error('MAGENTO_GRAPHQL_URL is not set'));
    await expect(resetPasswordAction(input)).resolves.toEqual({ status: 'failed' });
  });
});
