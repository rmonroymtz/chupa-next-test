// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetGooglePlacesForTests, searchPlaces } from '@/modules/address/ui/google-places';

type GlobalWithGoogle = { google?: unknown };

const fetchFields = vi.fn();
const fetchAutocompleteSuggestions = vi.fn();
let tokens = 0;

class FakeToken {
  readonly id = ++tokens;
}

function installGoogle(): void {
  (globalThis as GlobalWithGoogle).google = {
    maps: {
      importLibrary: vi.fn(async () => ({
        AutocompleteSessionToken: FakeToken,
        AutocompleteSuggestion: { fetchAutocompleteSuggestions },
      })),
    },
  };
}

const prediction = (placeId: string, text: string, components: unknown[]) => ({
  placePrediction: {
    placeId,
    text: { toString: () => text },
    toPlace: () => ({ fetchFields, addressComponents: components }),
  },
});

beforeEach(() => {
  resetGooglePlacesForTests();
  tokens = 0;
  fetchFields.mockReset().mockResolvedValue(undefined);
  fetchAutocompleteSuggestions.mockReset();
  installGoogle();
});
afterEach(() => {
  delete (globalThis as GlobalWithGoogle).google;
});

describe('searchPlaces', () => {
  it('asks the new API for Mexican suggestions in Spanish, with a session token', async () => {
    fetchAutocompleteSuggestions.mockResolvedValue({ suggestions: [] });
    await searchPlaces('AIza-test', 'Av. Revol');

    expect(fetchAutocompleteSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        input: 'Av. Revol',
        includedRegionCodes: ['mx'],
        language: 'es-MX',
        region: 'mx',
        sessionToken: expect.any(FakeToken),
      }),
    );
  });

  it('maps the predictions, skipping the ones without a place', async () => {
    fetchAutocompleteSuggestions.mockResolvedValue({
      suggestions: [prediction('p1', 'Av. Revolución, Tijuana', []), { placePrediction: null }],
    });
    const suggestions = await searchPlaces('AIza-test', 'Av');
    expect(suggestions.map((entry) => [entry.id, entry.text])).toEqual([
      ['p1', 'Av. Revolución, Tijuana'],
    ]);
  });

  it('loads the address components of the picked place with fetchFields and maps them', async () => {
    fetchAutocompleteSuggestions.mockResolvedValue({
      suggestions: [
        prediction('p1', 'x', [
          { longText: 'Avenida Revolución', shortText: 'Av. Revolución', types: ['route'] },
          { longText: null, types: undefined },
        ]),
      ],
    });
    const [suggestion] = await searchPlaces('AIza-test', 'Av');

    await expect(suggestion?.select()).resolves.toEqual([
      { longText: 'Avenida Revolución', shortText: 'Av. Revolución', types: ['route'] },
      { longText: '', shortText: '', types: [] },
    ]);
    expect(fetchFields).toHaveBeenCalledWith({ fields: ['addressComponents'] });
  });

  it('keeps one session token across searches and opens a new one after a selection', async () => {
    fetchAutocompleteSuggestions.mockResolvedValue({ suggestions: [prediction('p1', 'x', [])] });
    const [first] = await searchPlaces('AIza-test', 'A');
    await searchPlaces('AIza-test', 'Av');
    const tokensUsed = fetchAutocompleteSuggestions.mock.calls.map((call) => call[0].sessionToken);
    expect(tokensUsed[0]).toBe(tokensUsed[1]);

    await first?.select();
    await searchPlaces('AIza-test', 'Calle');
    expect(fetchAutocompleteSuggestions.mock.calls[2]?.[0].sessionToken).not.toBe(tokensUsed[0]);
  });

  it('rejects when Google Maps is not available, so the caller falls back to typing', async () => {
    delete (globalThis as GlobalWithGoogle).google;
    vi.useFakeTimers();
    const search = searchPlaces('AIza-test', 'Av');
    const assertion = expect(search).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(9000);
    await assertion;
    vi.useRealTimers();
  });
});
