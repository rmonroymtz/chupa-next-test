'use client';

import { useEffect, useState } from 'react';
import type { CustomerAddress } from '@/modules/address/application/ports';
import {
  addressFullName,
  cityRegionLine,
  sortAddresses,
} from '@/modules/address/domain/address-display';
import { deleteAddressAction, listAddressesAction } from '@/modules/address/ui/address-actions';
import { useAccountProfile } from '@/modules/account/ui/account-profile';
import { redirectBrowser } from '@/modules/account/ui/browser-redirect';
import { browserCartStorage } from '@/modules/cart/ui/pwa-cart-storage';
import { authHref } from '@/modules/customer/domain/auth-forms';
import { Button } from '@/shared/ui/button';
import { cx } from '@/shared/ui/class-names';

export const ADDRESS_BOOK_PATH = '/my-account/address-book';
const NEW_ADDRESS_PATH = `${ADDRESS_BOOK_PATH}/new`;
const editPath = (id: number): string => `${ADDRESS_BOOK_PATH}/edit/${id}`;

const LOAD_ERROR = 'Algo salió mal. Por favor, actualiza la página e inténtalo de nuevo.';
const DELETE_ERROR = 'No pudimos eliminar la dirección. Inténtalo de nuevo.';

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly addresses: readonly CustomerAddress[] };

/**
 * Legacy `AddressBook` (`/my-account/address-book`): the saved addresses as
 * cards, the default shipping address first with a "Principal" badge. A card
 * flips to a confirmation before deleting (the default address cannot be
 * deleted). The legacy "DIRECCIONES DE FACTURACIÓN" (RFC, CFDI) section belongs
 * to the billing phase and is not here.
 */
export function AddressBook() {
  const { token } = useAccountProfile();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);

  function handleUnauthorized(): void {
    browserCartStorage.clearSigninToken();
    redirectBrowser(authHref('/sign-in', ADDRESS_BOOK_PATH));
  }

  // Nothing sets state before the first await, so the mount effect never sets it synchronously.
  useEffect(() => {
    let cancelled = false;
    void listAddressesAction({ token })
      .catch(() => ({ status: 'failed' }) as const)
      .then((result) => {
        if (cancelled) return;
        if (result.status === 'ok') setState({ kind: 'ready', addresses: result.addresses });
        else if (result.status === 'not_authorized') handleUnauthorized();
        else setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function remove(address: CustomerAddress): Promise<void> {
    setDeletingId(address.id);
    setDeleteFailed(false);
    try {
      const result = await deleteAddressAction({ token, id: address.id });
      if (result.status === 'not_authorized') {
        handleUnauthorized();
        return;
      }
      if (result.status === 'failed') {
        setDeleteFailed(true);
        return;
      }
      setConfirmingId(null);
      // Magento confirmed the delete: drop the card instead of reading the whole list again.
      setState((current) =>
        current.kind === 'ready'
          ? {
              kind: 'ready',
              addresses: current.addresses.filter((entry) => entry.id !== address.id),
            }
          : current,
      );
    } catch {
      setDeleteFailed(true);
    } finally {
      setDeletingId(null);
    }
  }

  if (state.kind === 'loading') {
    return (
      <p role="status" className="py-16 text-center text-ds-text-secondary">
        Cargando tus direcciones…
      </p>
    );
  }

  if (state.kind === 'error') {
    return (
      <p role="alert" className="py-16 text-center text-ds-text-error">
        {LOAD_ERROR}
      </p>
    );
  }

  if (state.addresses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <h1 className="sr-only">MIS DIRECCIONES</h1>
        <h2 className="text-xl font-bold text-ds-text">¡Aún no tienes direcciones guardadas!</h2>
        <p className="max-w-md text-ds-text-secondary">
          Registra aquí tus direcciones de envío y facturación favoritas. De esta forma, tus
          próximas compras serán mucho más rápidas y sencillas.
        </p>
        <Button href={NEW_ADDRESS_PATH} nativeAnchor>
          Agregar dirección
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-sm font-bold tracking-wide text-ds-text-secondary">MIS DIRECCIONES</h1>
        <Button href={NEW_ADDRESS_PATH} nativeAnchor>
          Agregar dirección
        </Button>
      </div>
      {deleteFailed ? (
        <p role="alert" className="text-sm text-ds-text-error">
          {DELETE_ERROR}
        </p>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sortAddresses(state.addresses).map((address) => (
          <AddressCard
            key={address.id}
            address={address}
            confirming={confirmingId === address.id}
            deleting={deletingId === address.id}
            onAskDelete={() => {
              setDeleteFailed(false);
              setConfirmingId(address.id);
            }}
            onCancelDelete={() => setConfirmingId(null)}
            onDelete={() => void remove(address)}
          />
        ))}
      </ul>
    </div>
  );
}

interface AddressCardProps {
  readonly address: CustomerAddress;
  readonly confirming: boolean;
  readonly deleting: boolean;
  onAskDelete(): void;
  onCancelDelete(): void;
  onDelete(): void;
}

function AddressCard({
  address,
  confirming,
  deleting,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: AddressCardProps) {
  const name = addressFullName(address);
  const {
    custom_field_2: number,
    custom_field_3: colonia,
    custom_field_4: municipio,
  } = address.customFields;
  const lines = [
    ...address.street,
    number,
    colonia,
    municipio,
    cityRegionLine(address),
    address.postcode,
    address.telephone,
  ].filter((line) => line.trim() !== '');

  return (
    <li
      aria-label={name}
      aria-busy={deleting || undefined}
      className={cx(
        'flex flex-col gap-3 rounded-lg border border-ds-border-subtle bg-ds-surface p-5',
        deleting && 'opacity-50',
      )}
    >
      {address.defaultShipping ? (
        <span className="self-start rounded-pill bg-ds-surface-subtle px-2 py-0.5 text-xs font-semibold text-ds-text">
          Principal
        </span>
      ) : null}
      <p className="font-semibold text-ds-text">{name}</p>
      <div className="flex flex-col gap-0.5 text-sm text-ds-text-secondary">
        {lines.map((line, index) => (
          <span key={`${index}-${line}`}>{line}</span>
        ))}
      </div>
      {confirming ? (
        <div className="mt-auto flex gap-3">
          <Button type="button" size="sm" loading={deleting} onClick={onDelete}>
            Eliminar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="tertiary"
            disabled={deleting}
            onClick={onCancelDelete}
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="mt-auto flex items-center gap-4 text-sm">
          <a
            href={editPath(address.id)}
            aria-label={`Editar dirección de ${name}`}
            className="rounded-xs font-semibold text-ds-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus"
          >
            Editar
          </a>
          {address.defaultShipping ? null : (
            <button
              type="button"
              aria-label={`Eliminar dirección de ${name}`}
              onClick={onAskDelete}
              className="rounded-xs text-ds-text-secondary hover:text-ds-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus"
            >
              Eliminar
            </button>
          )}
        </div>
      )}
    </li>
  );
}
