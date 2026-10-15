import { describe, expect, it } from 'vitest';
import { discountPercent } from '@/modules/search/ui/chupachoice-section';

describe('discountPercent', () => {
  it('rounds the discount from the previous price', () => {
    expect(discountPercent(80, 100)).toBe(20);
    expect(discountPercent(3056.8, 3611.49)).toBe(15);
  });

  it.each([
    ['no previous price', 50, null],
    ['a zero previous price', 50, 0],
    ['a negative previous price', 50, -10],
    ['a non-finite previous price', 50, Number.NaN],
    ['a non-finite amount', Number.NaN, 100],
    ['a previous price below the amount', 120, 100],
  ])('is 0 for %s', (_label, amount, previous) => {
    expect(discountPercent(amount, previous)).toBe(0);
  });
});
