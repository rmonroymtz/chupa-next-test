// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEARCH_STORES } from '@/modules/layout/domain/search';
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

describe('StoreSelector: pill logos sized as the PWA', () => {
  it('each logo box is the PWA rendered size (max 72x18; Acme keeps the PWA 50px box)', () => {
    renderForm('/', '');
    const logos = within(screen.getByRole('radiogroup', { name: 'Tienda donde buscar' }))
      .getAllByRole('img')
      .map((logo) => [
        logo.getAttribute('alt'),
        logo.getAttribute('width'),
        logo.getAttribute('height'),
      ]);
    expect(logos).toEqual([
      ['ChupaChoice', '72', '9'],
      ['Amazon', '60', '18'],
      ['eBay', '45', '18'],
      ['Target', '72', '16'],
      ['Acme', '50', '5'],
    ]);
  });

  it('focus shows one line: the pill border turns red, no extra outline ring (PWA `.search:focus-within`)', () => {
    const css = readFileSync(
      join(process.cwd(), 'src/modules/layout/ui/search-form.module.css'),
      'utf8',
    );
    const rule = /\.field:focus-within\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('border-color: var(--color-ds-focus)');
    expect(rule).toContain('background-color: var(--color-ds-surface)');
    expect(rule).not.toContain('outline:');
    expect(css).not.toMatch(/\.field:has\(\.input:focus-visible\)/);
  });

  it('from 1160 the chosen store paints the tabs and the search field in its brand color (PWA `STORE_CONFIGS`)', () => {
    const css = readFileSync(
      join(process.cwd(), 'src/modules/layout/ui/search-form.module.css'),
      'utf8',
    );
    // One rule per store, so a store added to SEARCH_STORES without a color fails here.
    for (const { id } of SEARCH_STORES) {
      const rule = new RegExp(
        `\\.searchScope:has\\(input\\[name='store'\\]\\[value='${id}'\\]:checked\\)\\s*\\{([^}]*)\\}`,
      ).exec(css)?.[1];
      expect(rule, id).toContain(`--search-accent: var(--color-marketplace-${id})`);
    }
    // The tab, the field border and the submit all read that one variable.
    const desktop = css.slice(css.indexOf('@media (min-width: 72.5rem)'));
    expect(desktop.match(/var\(--search-accent\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(css).not.toContain('--color-ds-search-accent');
  });

  it('the store colors are the Figma active-tab colors, with a white search icon on every store', () => {
    const tokens = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const expected = {
      chupachoice: '#ff0000',
      amazon: '#ffa70f',
      ebay: '#0968f6',
      target: '#ca3432',
      acme: '#000000',
    };
    for (const [id, color] of Object.entries(expected)) {
      expect(tokens.toLowerCase(), id).toContain(`--color-marketplace-${id}: ${color};`);
    }
    const css = readFileSync(
      join(process.cwd(), 'src/modules/layout/ui/search-form.module.css'),
      'utf8',
    );
    expect(css.match(/--search-accent-ink:/g)?.length).toBe(1);
  });

  it('from 1160 the Acme Tools logo takes its Figma size (148x15), not the 50x5 PWA box', () => {
    render(<CurrentStoreSelector />);
    const acme = screen.getByRole('radio', { name: 'Acme' }).closest('label');
    expect(acme?.getAttribute('data-store')).toBe('acme');
    const css = readFileSync(
      join(process.cwd(), 'src/modules/layout/ui/search-form.module.css'),
      'utf8',
    );
    const desktop = css.slice(css.indexOf('@media (min-width: 72.5rem)'));
    const rule = /\.store\[data-store='acme'\] img\s*\{([^}]*)\}/.exec(desktop)?.[1] ?? '';
    expect(rule).toContain('width: 148px');
    expect(rule).toContain('height: 15px');
  });
});
