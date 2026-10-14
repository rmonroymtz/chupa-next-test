import { describe, expect, it } from 'vitest';
import { parsePageParam } from '@/modules/category/domain/category-page-param';

describe('parsePageParam', () => {
  it('defaults to the first page when the request has no page', () => {
    expect(parsePageParam('')).toEqual({ kind: 'valid', page: 1, explicit: false });
    expect(parsePageParam('utm_source=x')).toEqual({ kind: 'valid', page: 1, explicit: false });
  });

  it('accepts positive integers, page 1 included', () => {
    expect(parsePageParam('page=1')).toEqual({ kind: 'valid', page: 1, explicit: true });
    expect(parsePageParam('page=2')).toEqual({ kind: 'valid', page: 2, explicit: true });
    expect(parsePageParam('utm_source=x&page=12')).toEqual({
      kind: 'valid',
      page: 12,
      explicit: true,
    });
  });

  it.each([
    ['non-numeric', 'page=abc'],
    ['zero', 'page=0'],
    ['negative', 'page=-1'],
    ['decimal', 'page=1.5'],
    ['empty', 'page='],
    ['leading zero', 'page=02'],
    ['padded', 'page=%202'],
    ['exponent', 'page=1e2'],
    ['beyond a safe integer', 'page=99999999999999999999'],
    ['repeated', 'page=2&page=3'],
  ])('rejects a %s page', (_case, search) => {
    expect(parsePageParam(search)).toEqual({ kind: 'invalid' });
  });
});
