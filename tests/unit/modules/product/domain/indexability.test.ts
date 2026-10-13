import { describe, expect, it } from 'vitest';
import { getProductRobots } from '@/modules/product/domain/indexability';

describe('getProductRobots', () => {
  it('indexes and follows products that exist in Magento', () => {
    expect(getProductRobots({ existsInMagento: true })).toEqual({ index: true, follow: true });
  });

  it('noindexes but follows products that do not exist in Magento', () => {
    expect(getProductRobots({ existsInMagento: false })).toEqual({ index: false, follow: true });
  });

  it('accepts no visitor or bot input (anti-cloaking: same result for everyone)', () => {
    // @ts-expect-error -- visitor classification must never influence indexability.
    const withBotFlag = getProductRobots({ existsInMagento: false, isBot: true });
    // @ts-expect-error -- user agents must never influence indexability.
    const withUserAgent = getProductRobots({ existsInMagento: false, userAgent: 'Googlebot' });

    expect(getProductRobots.length).toBe(1);
    expect(withBotFlag).toEqual(getProductRobots({ existsInMagento: false }));
    expect(withUserAgent).toEqual(getProductRobots({ existsInMagento: false }));
  });
});
