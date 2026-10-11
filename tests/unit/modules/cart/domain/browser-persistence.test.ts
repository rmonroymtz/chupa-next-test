import { describe, expect, it } from 'vitest';
import {
  CART_ID_KEY,
  decodePersisted,
  encodePersisted,
  pwaStorageKey,
  SIGNIN_TOKEN_KEY,
} from '@/modules/cart/domain/browser-persistence';

const NOW = 1_760_000_000_000;

describe('pwaStorageKey', () => {
  it('namespaces names exactly like peregrine BrowserPersistence', () => {
    expect(pwaStorageKey(CART_ID_KEY)).toBe('M2_VENIA_BROWSER_PERSISTENCE__cartId');
    expect(pwaStorageKey(SIGNIN_TOKEN_KEY)).toBe('M2_VENIA_BROWSER_PERSISTENCE__signin_token');
  });
});

describe('encodePersisted', () => {
  it('writes the cart id without ttl, byte-identical to peregrine setItem', () => {
    // peregrine: JSON.stringify({ value: JSON.stringify(v), timeStored, ttl }) with ttl undefined.
    const legacy = JSON.stringify({
      value: JSON.stringify('abc123'),
      timeStored: NOW,
      ttl: undefined,
    });
    expect(encodePersisted('abc123', NOW)).toBe(legacy);
    expect(encodePersisted('abc123', NOW)).toBe(
      '{"value":"\\"abc123\\"","timeStored":1760000000000}',
    );
  });

  it('keeps value, timeStored, ttl key order when a ttl is given', () => {
    expect(encodePersisted('tok', NOW, 3600)).toBe(
      '{"value":"\\"tok\\"","timeStored":1760000000000,"ttl":3600}',
    );
  });
});

describe('decodePersisted', () => {
  it('reports missing for null, undefined and empty strings', () => {
    expect(decodePersisted(null, NOW)).toEqual({ status: 'missing' });
    expect(decodePersisted(undefined, NOW)).toEqual({ status: 'missing' });
    expect(decodePersisted('', NOW)).toEqual({ status: 'missing' });
  });

  it('round-trips a value written without ttl and never expires it', () => {
    const raw = encodePersisted('cart-1', NOW - 365 * 24 * 3600 * 1000);
    expect(decodePersisted(raw, NOW)).toEqual({ status: 'ok', value: 'cart-1' });
  });

  it('treats ttl 0 or null as no expiry (peregrine checks `ttl &&`)', () => {
    const old = NOW - 10_000_000;
    expect(decodePersisted(JSON.stringify({ value: '"a"', timeStored: old, ttl: 0 }), NOW)).toEqual(
      {
        status: 'ok',
        value: 'a',
      },
    );
    expect(
      decodePersisted(JSON.stringify({ value: '"a"', timeStored: old, ttl: null }), NOW),
    ).toEqual({ status: 'ok', value: 'a' });
  });

  it('expires only when now - timeStored is strictly greater than ttl seconds', () => {
    const at = (elapsedMs: number) => encodePersisted('tok', NOW - elapsedMs, 3600);
    expect(decodePersisted(at(3_600_000), NOW)).toEqual({ status: 'ok', value: 'tok' });
    expect(decodePersisted(at(3_600_001), NOW)).toEqual({ status: 'expired' });
  });

  it('reads tokens written by peregrine with a 3600 s ttl', () => {
    const raw = JSON.stringify({
      value: JSON.stringify('jwt.token'),
      timeStored: NOW - 1000,
      ttl: 3600,
    });
    expect(decodePersisted(raw, NOW)).toEqual({ status: 'ok', value: 'jwt.token' });
  });

  it('reports malformed envelopes and values instead of throwing', () => {
    expect(decodePersisted('not json', NOW)).toEqual({ status: 'malformed' });
    expect(decodePersisted('"just a string"', NOW)).toEqual({ status: 'malformed' });
    expect(decodePersisted('null', NOW)).toEqual({ status: 'malformed' });
    expect(decodePersisted(JSON.stringify({ value: '{oops', timeStored: NOW }), NOW)).toEqual({
      status: 'malformed',
    });
    expect(decodePersisted(JSON.stringify({ timeStored: NOW }), NOW)).toEqual({
      status: 'malformed',
    });
  });
});
