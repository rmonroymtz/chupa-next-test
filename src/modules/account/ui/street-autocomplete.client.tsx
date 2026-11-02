'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { PlaceComponent } from '@/modules/address/domain/address-autocomplete';
import { searchPlaces, type PlaceSuggestion } from '@/modules/address/ui/google-places';
import { cx } from '@/shared/ui/class-names';
import { Input } from '@/shared/ui/input';

const MIN_CHARACTERS = 3;
const DEBOUNCE_MS = 300;
const NOT_FOUND = 'No encontramos resultados para la dirección ingresada.';

interface StreetAutocompleteProps {
  readonly label: ReactNode;
  readonly apiKey: string;
  readonly value: string;
  /** The shopper typed. */
  onValueChange(value: string): void;
  /** The shopper picked a place: its address components. */
  onPlace(components: readonly PlaceComponent[]): void;
  readonly required?: boolean;
  readonly error?: string | undefined;
}

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'searching' }
  | { readonly kind: 'results'; readonly suggestions: readonly PlaceSuggestion[] }
  | { readonly kind: 'none' };

/**
 * The first street line with Google suggestions (legacy `Street` autocomplete,
 * on the new Places API). It searches 300 ms after the shopper stops typing,
 * from three characters on, and a pick hands the place's address to `onPlace`.
 * If Google fails (script, key, API not enabled) nothing is shown and the
 * address is typed as in a plain input. Only the latest search may answer.
 */
export function StreetAutocomplete({
  label,
  apiKey,
  value,
  onValueChange,
  onPlace,
  required,
  error,
}: StreetAutocompleteProps) {
  const listId = useId();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [active, setActive] = useState(-1);
  const latest = useRef(0);
  const typed = useRef(false);

  // Search only for what the shopper typed: a place filling the input must not search again.
  useEffect(() => {
    if (!typed.current) return;
    typed.current = false;
    const request = ++latest.current;
    if (value.trim().length < MIN_CHARACTERS) {
      const reset = setTimeout(() => setStatus({ kind: 'idle' }), 0);
      return () => clearTimeout(reset);
    }
    const timer = setTimeout(() => {
      setStatus({ kind: 'searching' });
      setActive(-1);
      searchPlaces(apiKey, value.trim())
        .then((suggestions) => {
          if (request !== latest.current) return;
          setStatus(suggestions.length > 0 ? { kind: 'results', suggestions } : { kind: 'none' });
        })
        .catch(() => {
          // No Google, no suggestions: the shopper keeps typing the address.
          if (request === latest.current) setStatus({ kind: 'idle' });
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, apiKey]);

  async function pick(suggestion: PlaceSuggestion): Promise<void> {
    const request = ++latest.current;
    setStatus({ kind: 'searching' });
    try {
      const components = await suggestion.select();
      if (request !== latest.current) return;
      setStatus({ kind: 'idle' });
      onPlace(components);
    } catch {
      if (request === latest.current) setStatus({ kind: 'none' });
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (status.kind !== 'results') return;
    const count = status.suggestions.length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(count - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      const chosen = status.suggestions[active];
      if (chosen) void pick(chosen);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setStatus({ kind: 'idle' });
    }
  }

  const open = status.kind === 'results';
  return (
    <div className="relative flex flex-col gap-2">
      <Input
        label={label}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-required={required || undefined}
        placeholder="Calle y número"
        autoComplete="off"
        value={value}
        onChange={(event) => {
          typed.current = true;
          onValueChange(event.target.value);
        }}
        onKeyDown={onKeyDown}
        error={error}
        helperText={status.kind === 'none' ? NOT_FOUND : undefined}
      />
      {status.kind === 'searching' ? (
        <p role="status" className="text-sm text-ds-text-secondary">
          Buscando dirección...
        </p>
      ) : null}
      {status.kind === 'results' ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-md border border-ds-border bg-ds-surface shadow-elevation-3"
        >
          {status.suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void pick(suggestion)}
              className={cx(
                'cursor-pointer px-4 py-3 text-sm text-ds-text hover:bg-ds-surface-subtle',
                index === active && 'bg-ds-surface-subtle',
              )}
            >
              {suggestion.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
