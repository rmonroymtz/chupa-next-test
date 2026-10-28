'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { browserCartStorage } from '@/modules/cart/ui/pwa-cart-storage';
import type { Customer } from '@/modules/customer/application/ports';
import { ACCOUNT_MENU_ITEMS, customerInitials } from '@/modules/customer/domain/account-menu';
import { getCustomerAction, signOutAction } from '@/modules/customer/ui/customer-actions';
import { Icon } from '@/shared/ui/icon';

// PWA `SignInButton` / `accountTrigger` `.action`: 20px icon, 8px gap, 14px label from 1160.
const ACTION_CLASS =
  'inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-xs text-body-md leading-normal text-ds-text hover:text-ds-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus desktop:min-w-0';
const SIGN_OUT = 'Cerrar sesión';

interface AccountActionProps {
  readonly signInHref: string;
}

type Session = { readonly token: string; readonly customer: Customer | null };

/**
 * Header "Mi cuenta". The server always renders the sign-in link (same box,
 * no layout shift); after hydration the island reads the PWA session from
 * storage and, when there is one, turns the link into the account menu of the
 * legacy header once Magento answers (a failed read still shows the menu, without
 * the name). A token Magento rejects is dropped and the link stays.
 */
export function AccountAction({ signInHref }: AccountActionProps) {
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const token = browserCartStorage.readSigninToken();
    if (!token) return;
    let cancelled = false;
    void getCustomerAction({ token })
      .catch(() => ({ status: 'failed' }) as const)
      .then((result) => {
        if (cancelled) return;
        if (result.status === 'not_authorized') browserCartStorage.clearSigninToken();
        else setSession({ token, customer: result.status === 'ok' ? result.customer : null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!session) {
    return (
      <a href={signInHref} className={ACTION_CLASS}>
        <Icon name="user" size={20} />
        <span className="whitespace-nowrap max-desktop:sr-only">Mi cuenta</span>
      </a>
    );
  }

  async function signOut(token: string): Promise<void> {
    setSigningOut(true);
    // Peregrine `signOut`: revoke (best effort), then forget the session, checkout data and cart.
    await signOutAction({ token }).catch(() => undefined);
    browserCartStorage.clearSigninToken();
    browserCartStorage.clearCheckoutData();
    browserCartStorage.clearCartId();
    window.location.reload();
  }

  const { customer } = session;
  const fullName = customer ? `${customer.firstName} ${customer.lastName}`.trim() : '';
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className={ACTION_CLASS}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="user" size={20} />
        <span className="whitespace-nowrap max-desktop:sr-only">Mi cuenta</span>
      </button>
      {open ? (
        <div
          id={menuId}
          className="absolute right-0 z-[70] mt-2 w-72 rounded-md border border-ds-border bg-ds-surface p-4 shadow-lg"
        >
          {customer ? (
            <div className="mb-3 flex items-center gap-3 border-b border-ds-border pb-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ds-surface-brand text-sm font-semibold text-ds-text"
              >
                {customerInitials(customer)}
              </span>
              <div className="min-w-0">
                {fullName ? <p className="truncate text-sm font-semibold">{fullName}</p> : null}
                <p className="truncate text-[13px] text-ds-text-secondary">{customer.email}</p>
              </div>
            </div>
          ) : null}
          <ul className="flex flex-col">
            {ACCOUNT_MENU_ITEMS.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="block rounded-xs px-1 py-2 text-sm text-ds-text hover:text-ds-accent focus-visible:outline-2 focus-visible:outline-ds-focus"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={signingOut}
            onClick={() => void signOut(session.token)}
            className="mt-3 w-full rounded-xs px-1 py-2 text-left text-sm font-semibold text-ds-cta focus-visible:outline-2 focus-visible:outline-ds-focus disabled:opacity-60"
          >
            {SIGN_OUT}
          </button>
        </div>
      ) : null}
    </div>
  );
}
