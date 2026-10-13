import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SEARCH_STORE,
  SEARCH_PATH,
  SEARCH_STORES,
  buildCategorySearchUrl,
  buildSearchUrl,
} from '@/modules/layout/domain/search';

describe('search urls (legacy /search.html contract)', () => {
  it('builds query, store and page=1 in the legacy order and encoding', () => {
    expect(buildSearchUrl({ query: 'audífonos bluetooth', store: 'ebay' })).toBe(
      '/search.html?query=aud%C3%ADfonos+bluetooth&store=ebay&page=1',
    );
  });

  it('trims the query like the legacy submit handler', () => {
    expect(buildSearchUrl({ query: '  lego  ', store: 'amazon' })).toBe(
      '/search.html?query=lego&store=amazon&page=1',
    );
  });

  it('category links search their url_path in the Amazon store', () => {
    expect(buildCategorySearchUrl('electronica/audio')).toBe(
      '/search.html?query=electronica%2Faudio&store=amazon&page=1',
    );
  });

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
