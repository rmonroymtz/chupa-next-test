// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchForm } from '@/modules/layout/ui/search-form';

const location = vi.hoisted(() => ({ pathname: '/', search: '' }));

vi.mock('next/navigation', () => ({
  usePathname: () => location.pathname,
  useSearchParams: () => new URLSearchParams(location.search),
}));

afterEach(cleanup);

function renderForm(pathname: string, search: string) {
  location.pathname = pathname;
  location.search = search;
  render(<SearchForm />);
  const form = screen.getByRole('search');
  return {
    query: (within(form).getByRole('searchbox') as HTMLInputElement).value,
    checked: (within(form).getAllByRole('radio') as HTMLInputElement[])
      .filter((radio) => radio.checked)
      .map((radio) => radio.value),
  };
}

describe('SearchForm: reflects the current search', () => {
  it('on /search.html: the searched store tab and query', () => {
    expect(renderForm('/search.html', 'query=taladro&store=ebay&page=1')).toEqual({
      query: 'taladro',
      checked: ['ebay'],
    });
  });

  it('on other pages: the default tab and an empty field', () => {
    expect(renderForm('/hogar.html', 'query=taladro&store=ebay')).toEqual({
      query: '',
      checked: ['chupachoice'],
    });
  });
});
