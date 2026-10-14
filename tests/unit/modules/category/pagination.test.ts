import { describe, expect, it } from 'vitest';
import { paginationItems } from '@/modules/category/domain/pagination';

describe('paginationItems', () => {
  it('lists nothing to paginate for zero or one page', () => {
    expect(paginationItems(1, 0)).toEqual([]);
    expect(paginationItems(1, 1)).toEqual([]);
  });

  it('lists every page when there are few', () => {
    expect(paginationItems(2, 3)).toEqual([1, 2, 3]);
    expect(paginationItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps the first, last and neighbouring pages and collapses the rest', () => {
    expect(paginationItems(1, 9)).toEqual([1, 2, 'gap', 9]);
    expect(paginationItems(5, 9)).toEqual([1, 'gap', 4, 5, 6, 'gap', 9]);
    expect(paginationItems(9, 9)).toEqual([1, 'gap', 8, 9]);
  });

  it('shows a lone hidden page instead of a gap', () => {
    expect(paginationItems(4, 9)).toEqual([1, 2, 3, 4, 5, 'gap', 9]);
  });
});
