import { describe, expect, it } from 'vitest';
import {
  currentSearch,
  DEFAULT_SEARCH_STORE,
  SEARCH_PATH,
  SEARCH_STORES,
} from '@/modules/layout/domain/search';

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

describe('currentSearch (what the header search bar shows)', () => {
  const params = (search: string) => new URLSearchParams(search);

  it('on the search page: the searched store and query', () => {
    expect(currentSearch('/search.html', params('query=taladro%20rojo&store=ebay&page=2'))).toEqual(
      {
        store: 'ebay',
        query: 'taladro rojo',
      },
    );
  });

  it('on the search page: a missing or unknown store is the default tab', () => {
    expect(currentSearch('/search.html', params('query=x'))).toEqual({
      store: 'chupachoice',
      query: 'x',
    });
    expect(currentSearch('/search.html', params('query=x&store=walmart')).store).toBe(
      'chupachoice',
    );
    expect(currentSearch('/search.html', params('query=x&store=%20AMAZON')).store).toBe('amazon');
  });

  it('on any other page (or without router data): the default tab and an empty field', () => {
    const empty = { store: 'chupachoice', query: '' };
    expect(currentSearch('/hogar.html', params('query=taladro&store=ebay'))).toEqual(empty);
    expect(currentSearch(null, null)).toEqual(empty);
  });
});
