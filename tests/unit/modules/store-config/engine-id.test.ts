import { describe, expect, it } from 'vitest';
import {
  resolveEngineId,
  resolveSearchEngineId,
  type EngineRouting,
} from '@/modules/store-config/domain/store-config';

// Values recorded from the live storeConfig (2026-10-09).
const routing: EngineRouting = {
  engineSettings: {
    amazon: 'direct',
    ebay: 'api',
    acme: 'direct',
    target: 'direct',
    walmart: 'direct',
    homedepot: 'direct',
  },
  // Recorded from staging (2026-10-15).
  searchEngineSettings: {
    amazon: 'direct',
    ebay: 'api',
    acme: 'direct',
    target: 'direct',
    walmart: 'direct',
    homedepot: 'bigbox',
  },
  serviceFallback: {
    amazon: 'amazon',
    ebay: 'ebay',
    acme: 'acme',
    target: 'target',
    walmart: 'walmart',
    homedepot: 'amazon',
  },
};

describe('resolveEngineId', () => {
  it('reads the engine of the store service fallback', () => {
    expect(resolveEngineId('ebay', routing)).toBe('api');
    expect(resolveEngineId('amazon', routing)).toBe('direct');
  });

  it('follows the fallback to another store engine', () => {
    const custom: EngineRouting = {
      engineSettings: { amazon: 'rainforest', homedepot: 'bigbox' },
      searchEngineSettings: {},
      serviceFallback: { homedepot: 'amazon' },
    };

    expect(resolveEngineId('homedepot', custom)).toBe('rainforest');
  });

  it('is case-insensitive on the store name', () => {
    expect(resolveEngineId('EBAY', routing)).toBe('api');
  });

  it('returns null when the store has no fallback', () => {
    expect(resolveEngineId('unknown', routing)).toBeNull();
    expect(resolveEngineId('ebay', { ...routing, serviceFallback: {} })).toBeNull();
  });

  it('returns null when the fallback store has no engine', () => {
    expect(
      resolveEngineId('ebay', {
        engineSettings: { ebay: null },
        searchEngineSettings: {},
        serviceFallback: { ebay: 'ebay' },
      }),
    ).toBeNull();
    expect(
      resolveEngineId('ebay', {
        engineSettings: { ebay: '  ' },
        searchEngineSettings: {},
        serviceFallback: { ebay: 'ebay' },
      }),
    ).toBeNull();
  });
});

describe('resolveSearchEngineId', () => {
  it('reads the search engine of the store service fallback', () => {
    expect(resolveSearchEngineId('ebay', routing)).toBe('api');
    expect(resolveSearchEngineId('amazon', routing)).toBe('direct');
  });

  it('follows the fallback to another store search engine', () => {
    // homedepot falls back to amazon, so its own `bigbox` search engine is not used.
    expect(resolveSearchEngineId('homedepot', routing)).toBe('direct');
  });

  it('never reads the product engine', () => {
    expect(
      resolveSearchEngineId('ebay', {
        engineSettings: { ebay: 'api' },
        searchEngineSettings: {},
        serviceFallback: { ebay: 'ebay' },
      }),
    ).toBeNull();
  });

  it('is case-insensitive on the store name and fallback', () => {
    expect(resolveSearchEngineId('EBAY', routing)).toBe('api');
    expect(resolveSearchEngineId('ebay', { ...routing, serviceFallback: { ebay: ' EBAY ' } })).toBe(
      'api',
    );
  });

  it('returns null for an unknown store or a store without fallback', () => {
    expect(resolveSearchEngineId('chupachoice', routing)).toBeNull();
    expect(resolveSearchEngineId('ebay', { ...routing, serviceFallback: {} })).toBeNull();
    expect(
      resolveSearchEngineId('ebay', { ...routing, serviceFallback: { ebay: '  ' } }),
    ).toBeNull();
  });

  it('returns null when the fallback store has no search engine', () => {
    expect(
      resolveSearchEngineId('ebay', { ...routing, searchEngineSettings: { ebay: null } }),
    ).toBeNull();
    expect(
      resolveSearchEngineId('ebay', { ...routing, searchEngineSettings: { ebay: '  ' } }),
    ).toBeNull();
  });
});
