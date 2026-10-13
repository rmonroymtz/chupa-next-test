import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLogger = vi.fn();
const getServerEnv = vi.fn();
const getMagentoClient = vi.fn();

vi.mock('@/shared/observability/logger', () => ({ getLogger: () => getLogger() }));
vi.mock('@/shared/config/env', () => ({ getServerEnv: () => getServerEnv() }));
vi.mock('@/shared/graphql/client', () => ({ getMagentoClient: () => getMagentoClient() }));

const { getCategoryMenu } =
  await import('@/modules/layout/infrastructure/category-menu.composition');

describe('getCategoryMenu composition', () => {
  beforeEach(() => {
    getLogger.mockReset();
    getServerEnv.mockReset();
    getMagentoClient.mockReset();
  });

  it('resolves to no items when configuration and the logger both fail', async () => {
    getServerEnv.mockImplementation(() => {
      throw new Error('invalid env');
    });
    getLogger.mockImplementation(() => {
      throw new Error('logger unavailable');
    });
    await expect(getCategoryMenu()).resolves.toEqual([]);
  });

  it('logs the failure through the lazily created logger when it is available', async () => {
    const warn = vi.fn();
    getLogger.mockReturnValue({ child: () => ({ warn }) });
    getMagentoClient.mockImplementation(() => {
      throw new Error('no client');
    });
    getServerEnv.mockReturnValue({ MAGENTO_MENU_TIMEOUT_MS: 100 });
    await expect(getCategoryMenu()).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'header menu unavailable',
    );
  });
});
