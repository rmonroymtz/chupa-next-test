// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchForm } from '@/modules/layout/ui/search-form';
import { CurrentStoreSelector } from '@/modules/layout/ui/store-selector.client';

const location = vi.hoisted(() => ({ pathname: '/', search: '' }));

vi.mock('next/navigation', () => ({
  usePathname: () => location.pathname,
  useSearchParams: () => new URLSearchParams(location.search),
}));

afterEach(cleanup);

function renderForm(pathname: string, search: string) {
  location.pathname = pathname;
  location.search = search;
  render(
    <>
      <CurrentStoreSelector />
      <SearchForm />
    </>,
  );
  const form = screen.getByRole('search') as HTMLFormElement;
  const pills = within(screen.getByRole('radiogroup', { name: 'Tienda donde buscar' }));
  return {
    query: (within(form).getByRole('searchbox') as HTMLInputElement).value,
    checked: (pills.getAllByRole('radio') as HTMLInputElement[])
      .filter((radio) => radio.checked)
      .map((radio) => radio.value),
    // What the GET form submits (the pills sit outside it, in the header top row).
    submitted: Object.fromEntries(new FormData(form)),
  };
}

describe('SearchForm: reflects the current search', () => {
  it('on /search.html: the searched store pill and query', () => {
    expect(renderForm('/search.html', 'query=taladro&store=ebay&page=1')).toEqual({
      query: 'taladro',
      checked: ['ebay'],
      submitted: { store: 'ebay', query: 'taladro', page: '1' },
    });
  });

  it('on other pages: the default store pill and an empty field', () => {
    expect(renderForm('/hogar.html', 'query=taladro&store=ebay')).toEqual({
      query: '',
      checked: ['chupachoice'],
      submitted: { store: 'chupachoice', query: '', page: '1' },
    });
  });
});
