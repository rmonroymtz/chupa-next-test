'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { buildBreadcrumb } from '@/modules/account/domain/account-pages';
import { AccountBreadcrumb } from '@/modules/account/ui/account-breadcrumb';
import { AccountProfileProvider } from '@/modules/account/ui/account-profile';
import { redirectBrowser } from '@/modules/account/ui/browser-redirect';
import { browserCartStorage } from '@/modules/cart/ui/pwa-cart-storage';
import type { CustomerProfile } from '@/modules/customer/application/ports';
import { authHref } from '@/modules/customer/domain/auth-forms';
import { getCustomerProfileAction } from '@/modules/customer/ui/customer-actions';

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly profile: CustomerProfile; readonly token: string };

/**
 * Guard and frame of every account page (legacy `AuthRoute` + `Breadcrumb`).
 * The sign-in token lives in the PWA's `localStorage`, so the check runs in
 * the browser: no token, or a token Magento rejects, sends the shopper to
 * `/sign-in?from=<this page>` (the legacy stored `state.from` but nothing read
 * it). The profile is read once and shared with the page through context; a
 * failed read keeps the session and shows the legacy error.
 */
export function AccountShell({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<State>({ kind: 'loading' });

  const query = search.toString();
  const here = query ? `${pathname}?${query}` : pathname;
  const hereRef = useRef(here);
  useEffect(() => {
    hereRef.current = here;
  }, [here]);

  // Nothing sets state before the first await, so the mount effect never sets it synchronously.
  useEffect(() => {
    const token = browserCartStorage.readSigninToken();
    if (!token) {
      redirectBrowser(authHref('/sign-in', hereRef.current));
      return;
    }
    let cancelled = false;
    void getCustomerProfileAction({ token })
      .catch(() => ({ status: 'failed' }) as const)
      .then((result) => {
        if (cancelled) return;
        if (result.status === 'ok') {
          setState({ kind: 'ready', profile: result.profile, token });
        } else if (result.status === 'not_authorized') {
          browserCartStorage.clearSigninToken();
          redirectBrowser(authHref('/sign-in', hereRef.current));
        } else {
          setState({ kind: 'error' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === 'loading') {
    return (
      <p role="status" className="py-16 text-center text-ds-text-secondary">
        Cargando tu cuenta…
      </p>
    );
  }

  if (state.kind === 'error') {
    return (
      <p role="alert" className="py-16 text-center text-ds-text-error">
        Algo salió mal. Por favor, actualiza la página e inténtalo de nuevo.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AccountBreadcrumb crumbs={buildBreadcrumb(pathname, search.get('callbackUrl'))} />
      <AccountProfileProvider profile={state.profile} token={state.token}>
        {children}
      </AccountProfileProvider>
    </div>
  );
}
