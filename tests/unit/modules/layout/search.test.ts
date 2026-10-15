import { describe, expect, it } from 'vitest';
import { DEFAULT_SEARCH_STORE, SEARCH_PATH, SEARCH_STORES } from '@/modules/layout/domain/search';

describe('search bar (legacy /search.html contract)', () => {
  it('offers the legacy store tabs in position order, ChupaChoice first and default', () => {
    expect(SEARCH_STORES.map((store) => store.id)).toEqual([
      'chupachoice',
      'amazon',
      'ebay',
      'target',
      'acme',
    ]);
    expect(DEFAULT_SEARCH_STORE).toBe('chupachoice');
    expect(SEARCH_PATH).toBe('/search.html');
  });
});
