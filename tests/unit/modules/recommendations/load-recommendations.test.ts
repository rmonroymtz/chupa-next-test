import { describe, expect, it, vi } from 'vitest';
import { loadRecommendations } from '@/modules/recommendations/application/load-recommendations';
import type { RecommendedProduct } from '@/modules/recommendations/domain/recommendation';

const card: RecommendedProduct = {
  uid: 'amazon-B1',
  sku: 'B1',
  name: 'Taladro',
  urlKey: 'amazon-B1-taladro',
  relativeUrl: 'amazon-B1-taladro.html',
  image: null,
  price: null,
  availability: 'unknown',
  rating: null,
};

describe('loadRecommendations', () => {
  it('asks the repository for 30 products of the slider type (legacy limit)', async () => {
    const findRandom = vi.fn().mockResolvedValue([card]);
    const warn = vi.fn();

    await expect(
      loadRecommendations('also_bought', { repository: { findRandom }, logger: { warn } }),
    ).resolves.toEqual([card]);
    expect(findRandom).toHaveBeenCalledWith('also_bought', 30);
    expect(warn).not.toHaveBeenCalled();
  });

  it('never rejects: a failure is logged and the slider gets no products', async () => {
    const error = new Error('magento down');
    const warn = vi.fn();

    await expect(
      loadRecommendations('tendency', {
        repository: { findRandom: () => Promise.reject(error) },
        logger: { warn },
      }),
    ).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      { type: 'tendency', err: error },
      'recommendations unavailable',
    );
  });

  it('never rejects when the repository throws synchronously', async () => {
    await expect(
      loadRecommendations('recently', {
        repository: {
          findRandom: () => {
            throw new Error('no client');
          },
        },
        logger: { warn: vi.fn() },
      }),
    ).resolves.toEqual([]);
  });
});
