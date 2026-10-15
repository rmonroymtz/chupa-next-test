import { describe, expect, it } from 'vitest';
import type { SearchPagination } from '@/modules/search/domain/search-result';
import { searchPaginationModel } from '@/modules/search/domain/search-pagination';

const pagination = (overrides: Partial<SearchPagination> = {}): SearchPagination => ({
  current: 1,
  totalPages: null,
  next: null,
  prev: null,
  links: [],
  ...overrides,
});

describe('searchPaginationModel (CHAPI links, no total pages)', () => {
  it('first page: the current page, the linked pages in order and next', () => {
    const model = searchPaginationModel(
      pagination({
        next: 'next-link',
        links: [
          { title: '3', link: 'p3' },
          { title: '2', link: 'p2' },
        ],
      }),
      null,
    );

    expect(model).toEqual({
      prev: null,
      next: { page: '2', link: 'next-link' },
      pages: [
        { page: '1', link: null },
        { page: '2', link: 'p2' },
        { page: '3', link: 'p3' },
      ],
    });
  });

  it('a middle page puts the current page between the links CHAPI returns', () => {
    const model = searchPaginationModel(
      pagination({
        current: 2,
        prev: 'prev-link',
        next: 'next-link',
        links: [
          { title: '1', link: 'p1' },
          { title: '3', link: 'p3' },
        ],
      }),
      2,
    );

    expect(model.prev).toEqual({ page: '1', link: 'prev-link' });
    expect(model.next).toEqual({ page: '3', link: 'next-link' });
    expect(model.pages).toEqual([
      { page: '1', link: 'p1' },
      { page: '2', link: null },
      { page: '3', link: 'p3' },
    ]);
  });

  it('the url page (display only) wins over the CHAPI current page', () => {
    const model = searchPaginationModel(
      pagination({ current: 1, prev: 'prev-link', links: [{ title: '4', link: 'p4' }] }),
      5,
    );

    expect(model.prev).toEqual({ page: '4', link: 'prev-link' });
    expect(model.pages).toEqual([
      { page: '4', link: 'p4' },
      { page: '5', link: null },
    ]);
  });

  it('drops a link for the current page and repeated pages', () => {
    const model = searchPaginationModel(
      pagination({
        next: 'n',
        links: [
          { title: '1', link: 'p1' },
          { title: '2', link: 'p2' },
          { title: '2', link: 'p2-again' },
        ],
      }),
      1,
    );

    expect(model.pages).toEqual([
      { page: '1', link: null },
      { page: '2', link: 'p2' },
    ]);
  });

  it('keeps non-numeric link titles after the numbered pages, in CHAPI order', () => {
    const model = searchPaginationModel(
      pagination({
        links: [
          { title: 'Última', link: 'last' },
          { title: '2', link: 'p2' },
        ],
      }),
      null,
    );

    expect(model.pages).toEqual([
      { page: '1', link: null },
      { page: '2', link: 'p2' },
      { page: 'Última', link: 'last' },
    ]);
  });

  it('keeps a repeated non-numeric title once', () => {
    const model = searchPaginationModel(
      pagination({
        links: [
          { title: 'Última', link: 'last' },
          { title: 'Última', link: 'last-again' },
        ],
      }),
      null,
    );

    expect(model.pages).toEqual([
      { page: '1', link: null },
      { page: 'Última', link: 'last' },
    ]);
  });

  it('is empty when there is nothing to paginate', () => {
    expect(searchPaginationModel(pagination(), null)).toEqual({
      prev: null,
      next: null,
      pages: [],
    });
  });
});
