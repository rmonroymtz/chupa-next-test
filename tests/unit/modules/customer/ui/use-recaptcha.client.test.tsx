// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getConfig = vi.hoisted(() => vi.fn());
vi.mock('@/modules/customer/ui/customer-actions', () => ({ getRecaptchaConfigAction: getConfig }));

const CONFIG = {
  siteKey: 'k',
  badgePosition: 'bottomright',
  languageCode: null,
  forms: ['CUSTOMER_LOGIN'],
};

async function loadHook() {
  vi.resetModules();
  return (await import('@/modules/customer/ui/use-recaptcha')).useRecaptcha;
}

beforeEach(() => {
  getConfig.mockReset();
  (globalThis as Record<string, unknown>).grecaptcha = {
    execute: vi.fn().mockResolvedValue('rc-token'),
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (globalThis as Record<string, unknown>).grecaptcha;
});

describe('useRecaptcha', () => {
  it('answers a token for a form Magento lists and null for one it does not', async () => {
    getConfig.mockResolvedValue(CONFIG);
    const useRecaptcha = await loadHook();
    const login = renderHook(() => useRecaptcha('CUSTOMER_LOGIN'));
    await expect(login.result.current('signIn')).resolves.toBe('rc-token');
    const create = renderHook(() => useRecaptcha('CUSTOMER_CREATE'));
    await expect(create.result.current('createAccount')).resolves.toBeNull();
  });

  it('does not cache a missing config: a later submit asks Magento again', async () => {
    getConfig.mockResolvedValueOnce(null).mockResolvedValue(CONFIG);
    const useRecaptcha = await loadHook();
    const { result } = renderHook(() => useRecaptcha('CUSTOMER_LOGIN'));
    await expect(result.current('signIn')).resolves.toBeNull();
    await expect(result.current('signIn')).resolves.toBe('rc-token');
  });

  it('gives up with null when the script never loads', async () => {
    delete (globalThis as Record<string, unknown>).grecaptcha;
    getConfig.mockResolvedValue(CONFIG);
    const useRecaptcha = await loadHook();
    vi.useFakeTimers();
    const { result } = renderHook(() => useRecaptcha('CUSTOMER_LOGIN'));
    const token = result.current('signIn');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    await expect(token).resolves.toBeNull();
  });
});
