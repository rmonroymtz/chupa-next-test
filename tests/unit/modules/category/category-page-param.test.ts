import { describe, expect, it } from 'vitest';
import { parsePageParam, withPageParam } from '@/modules/category/domain/category-page-param';

describe('parsePageParam', () => {
  it('defaults to the first page when the request has no page', () => {
    expect(parsePageParam('')).toEqual({ kind: 'valid', page: 1, explicit: false });
    expect(parsePageParam('utm_source=x')).toEqual({ kind: 'valid', page: 1, explicit: false });
  });

  it('accepts positive integers, page 1 included', () => {
    expect(parsePageParam('page=1')).toEqual({ kind: 'valid', page: 1, explicit: true });
    expect(parsePageParam('page=2')).toEqual({ kind: 'valid', page: 2, explicit: true });
    expect(parsePageParam('page=2147483647')).toEqual({
      kind: 'valid',
      page: 2147483647,
      explicit: true,
    });
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
    ['beyond a GraphQL Int (2^31)', 'page=2147483648'],
    ['repeated', 'page=2&page=3'],
  ])('rejects a %s page', (_case, search) => {
    expect(parsePageParam(search)).toEqual({ kind: 'invalid' });
  });
});

describe('withPageParam', () => {
  it('sets the page and keeps the other parameters in order', () => {
    expect(withPageParam('', 2)).toBe('page=2');
    expect(withPageParam('utm_source=x&tag=a', 3)).toBe('utm_source=x&tag=a&page=3');
    expect(withPageParam('utm_source=x&page=5&tag=a', 4)).toBe('utm_source=x&page=4&tag=a');
  });

  it('drops the parameter for the first page, whose url is the clean category url', () => {
    expect(withPageParam('page=3', 1)).toBe('');
    expect(withPageParam('utm_source=x&page=3', 1)).toBe('utm_source=x');
  });
});
