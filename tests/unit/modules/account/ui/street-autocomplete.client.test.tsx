// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaceComponent } from '@/modules/address/domain/address-autocomplete';
import { StreetAutocomplete } from '@/modules/account/ui/street-autocomplete.client';

const places = vi.hoisted(() => ({ searchPlaces: vi.fn() }));
vi.mock('@/modules/address/ui/google-places', () => places);

const COMPONENTS: PlaceComponent[] = [{ longText: 'Av.', shortText: 'Av.', types: ['route'] }];

const suggestion = (
  id: string,
  text: string,
  components: readonly PlaceComponent[] = COMPONENTS,
) => ({
  id,
  text,
  select: vi.fn().mockResolvedValue(components),
});

function Harness({ onPlace }: { onPlace: (components: readonly PlaceComponent[]) => void }) {
  const [value, setValue] = useState('');
  return (
    <StreetAutocomplete
      label="Dirección"
      apiKey="AIza-test"
      value={value}
      onValueChange={setValue}
      onPlace={onPlace}
    />
  );
}

const input = () => screen.getByRole('combobox') as HTMLInputElement;
const type = (value: string) => fireEvent.change(input(), { target: { value } });
const settle = () => act(async () => void (await vi.advanceTimersByTimeAsync(400)));

beforeEach(() => {
  vi.useFakeTimers();
  places.searchPlaces.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('StreetAutocomplete', () => {
  it('searches after a pause and lists the suggestions', async () => {
    places.searchPlaces.mockResolvedValue([
      suggestion('1', 'Av. Revolución, Tijuana'),
      suggestion('2', 'Av. Reforma'),
    ]);
    render(<Harness onPlace={vi.fn()} />);

    type('Av. Rev');
    expect(places.searchPlaces).not.toHaveBeenCalled();
    await settle();

    expect(places.searchPlaces).toHaveBeenCalledWith('AIza-test', 'Av. Rev');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Av. Revolución, Tijuana',
      'Av. Reforma',
    ]);
    expect(input().getAttribute('aria-expanded')).toBe('true');
  });

  it('does not search for fewer than three characters', async () => {
    render(<Harness onPlace={vi.fn()} />);
    type('Av');
    await settle();
    expect(places.searchPlaces).not.toHaveBeenCalled();
  });

  it('shows the searching message while it waits', async () => {
    places.searchPlaces.mockReturnValue(new Promise(() => {}));
    render(<Harness onPlace={vi.fn()} />);
    type('Av. Rev');
    await settle();
    expect(screen.getByRole('status').textContent).toBe('Buscando dirección...');
  });

  it('loads the picked place, hands its components over and closes the list', async () => {
    const picked = suggestion('1', 'Av. Revolución, Tijuana');
    places.searchPlaces.mockResolvedValue([picked]);
    const onPlace = vi.fn();
    render(<Harness onPlace={onPlace} />);
    type('Av. Rev');
    await settle();

    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: 'Av. Revolución, Tijuana' }));
    });

    expect(picked.select).toHaveBeenCalledTimes(1);
    expect(onPlace).toHaveBeenCalledWith(COMPONENTS);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('picks with the keyboard: arrows move, Enter selects, Escape closes', async () => {
    const first = suggestion('1', 'Uno');
    const second = suggestion('2', 'Dos');
    places.searchPlaces.mockResolvedValue([first, second]);
    const onPlace = vi.fn();
    render(<Harness onPlace={onPlace} />);
    type('Calle');
    await settle();

    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    await act(async () => {
      fireEvent.keyDown(input(), { key: 'Enter' });
    });
    expect(second.select).toHaveBeenCalled();
    expect(first.select).not.toHaveBeenCalled();

    type('Calle 2');
    await settle();
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('says so when there are no results', async () => {
    places.searchPlaces.mockResolvedValue([]);
    render(<Harness onPlace={vi.fn()} />);
    type('Calle inexistente');
    await settle();
    expect(screen.getByText('No encontramos resultados para la dirección ingresada.')).toBeTruthy();
  });

  it('says so when the picked place cannot be loaded', async () => {
    const broken = suggestion('1', 'Roto');
    broken.select.mockRejectedValue(new Error('boom'));
    places.searchPlaces.mockResolvedValue([broken]);
    const onPlace = vi.fn();
    render(<Harness onPlace={onPlace} />);
    type('Calle');
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: 'Roto' }));
    });
    expect(onPlace).not.toHaveBeenCalled();
    expect(screen.getByText('No encontramos resultados para la dirección ingresada.')).toBeTruthy();
  });

  it('stays silent and keeps typing possible when Google fails', async () => {
    places.searchPlaces.mockRejectedValue(new Error('Places API not enabled'));
    render(<Harness onPlace={vi.fn()} />);
    type('Calle');
    await settle();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByText('No encontramos resultados para la dirección ingresada.')).toBeNull();
    type('Calle Nueva');
    expect(input().value).toBe('Calle Nueva');
  });

  it('ignores the answer of an older search', async () => {
    let resolveOld: (value: unknown) => void = () => {};
    places.searchPlaces
      .mockReturnValueOnce(new Promise((resolve) => (resolveOld = resolve)))
      .mockResolvedValueOnce([suggestion('2', 'Nueva')]);
    render(<Harness onPlace={vi.fn()} />);
    type('Calle uno');
    await settle();
    type('Calle dos');
    await settle();
    await act(async () => resolveOld([suggestion('1', 'Vieja')]));

    expect(screen.queryByRole('option', { name: 'Vieja' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Nueva' })).toBeTruthy();
  });
});
