import type { PlaceComponent } from '@/modules/address/domain/address-autocomplete';

/**
 * Browser client of the new Google Places API (the legacy PWA uses the
 * `AutocompleteService` through `react-google-autocomplete`, the legacy line):
 * `AutocompleteSuggestion.fetchAutocompleteSuggestions` for the suggestions and
 * `Place.fetchFields` for the address of the picked one, with session tokens so
 * the lookups bill as one session. The key comes from Magento's Amasty config
 * and is a browser key. A failure here only means no suggestions: the address
 * can always be typed.
 */

export interface PlaceSuggestion {
  readonly id: string;
  readonly text: string;
  /** Loads the address components of this place and ends the billing session. */
  select(): Promise<readonly PlaceComponent[]>;
}

interface RawComponent {
  longText?: string | null;
  shortText?: string | null;
  types?: string[];
}

interface RawPlace {
  fetchFields(request: { fields: string[] }): Promise<unknown>;
  addressComponents?: RawComponent[] | null;
}

interface RawPrediction {
  placeId: string;
  text: { toString(): string };
  toPlace(): RawPlace;
}

interface PlacesLibrary {
  AutocompleteSessionToken: new () => unknown;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(
      request: Record<string, unknown>,
    ): Promise<{ suggestions: { placePrediction?: RawPrediction | null }[] }>;
  };
}

interface GoogleGlobal {
  maps?: { importLibrary?: (name: string) => Promise<unknown> };
}

const SCRIPT_BASE = 'https://maps.googleapis.com/maps/api/js';
const READY_CALLBACK = '__chupaGoogleMapsReady';
const LOAD_TIMEOUT_MS = 8000;

let libraryPromise: Promise<PlacesLibrary> | undefined;
let sessionToken: unknown = null;

const googleGlobal = (): GoogleGlobal | undefined =>
  (globalThis as { google?: GoogleGlobal }).google;

function importPlaces(): Promise<PlacesLibrary> {
  const importLibrary = googleGlobal()?.maps?.importLibrary;
  if (!importLibrary) return Promise.reject(new Error('Google Maps did not load'));
  return importLibrary('places') as Promise<PlacesLibrary>;
}

/** One script load per page; a failure is forgotten so the next search tries again. */
function loadPlaces(apiKey: string): Promise<PlacesLibrary> {
  if (googleGlobal()?.maps?.importLibrary) return importPlaces();
  libraryPromise ??= new Promise<PlacesLibrary>((resolve, reject) => {
    const fail = (reason: string): void => {
      libraryPromise = undefined;
      reject(new Error(reason));
    };
    const timer = setTimeout(() => fail('Google Maps script timed out'), LOAD_TIMEOUT_MS);
    (globalThis as Record<string, unknown>)[READY_CALLBACK] = () => {
      clearTimeout(timer);
      importPlaces().then(resolve, (caught: unknown) => fail(String(caught)));
    };
    const script = document.createElement('script');
    const query = new URLSearchParams({
      key: apiKey,
      loading: 'async',
      callback: READY_CALLBACK,
      language: 'es-MX',
      region: 'MX',
      v: 'weekly',
    });
    script.src = `${SCRIPT_BASE}?${query.toString()}`;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      fail('Google Maps script failed to load');
    };
    document.head.appendChild(script);
  });
  return libraryPromise;
}

/** Suggestions for what the shopper typed, restricted to Mexico and answered in Spanish. */
export async function searchPlaces(apiKey: string, input: string): Promise<PlaceSuggestion[]> {
  const library = await loadPlaces(apiKey);
  sessionToken ??= new library.AutocompleteSessionToken();
  const { suggestions } = await library.AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    sessionToken,
    includedRegionCodes: ['mx'],
    language: 'es-MX',
    region: 'mx',
  });
  return suggestions.flatMap((suggestion): PlaceSuggestion[] => {
    const prediction = suggestion.placePrediction;
    if (!prediction) return [];
    return [
      {
        id: prediction.placeId,
        text: prediction.text.toString(),
        async select() {
          const place = prediction.toPlace();
          await place.fetchFields({ fields: ['addressComponents'] });
          // `fetchFields` ends the session: the next search opens a new one.
          sessionToken = null;
          return (place.addressComponents ?? []).map((component) => ({
            longText: component.longText ?? '',
            shortText: component.shortText ?? '',
            types: component.types ?? [],
          }));
        },
      },
    ];
  });
}

/** Tests only. */
export function resetGooglePlacesForTests(): void {
  libraryPromise = undefined;
  sessionToken = null;
}
