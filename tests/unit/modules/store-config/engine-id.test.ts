import { describe, expect, it } from 'vitest';
import { resolveEngineId, type EngineRouting } from '@/modules/store-config/domain/store-config';

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
      serviceFallback: { homedepot: 'amazon' },
    };

    expect(resolveEngineId('homedepot', custom)).toBe('rainforest');
  });

  it('is case-insensitive on the store name', () => {
    expect(resolveEngineId('EBAY', routing)).toBe('api');
  });

  it('returns null when the store has no fallback', () => {
    expect(resolveEngineId('unknown', routing)).toBeNull();
    expect(
      resolveEngineId('ebay', { engineSettings: routing.engineSettings, serviceFallback: {} }),
    ).toBeNull();
  });

  it('returns null when the fallback store has no engine', () => {
    expect(
      resolveEngineId('ebay', {
        engineSettings: { ebay: null },
        serviceFallback: { ebay: 'ebay' },
      }),
    ).toBeNull();
    expect(
      resolveEngineId('ebay', {
        engineSettings: { ebay: '  ' },
        serviceFallback: { ebay: 'ebay' },
      }),
    ).toBeNull();
  });
});
