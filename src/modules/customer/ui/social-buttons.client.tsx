'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { browserCartStorage } from '@/modules/cart/ui/pwa-cart-storage';
import type { SocialLoginButton } from '@/modules/customer/application/ports';
import {
  isTrustedPopupMessage,
  parsePopupMessage,
  popupFeatures,
  popupUrl,
} from '@/modules/customer/domain/social-popup';
import { FormError } from '@/modules/customer/ui/form-error';
import { completeSocialSignInAction } from '@/modules/customer/ui/social-login-actions';
import { startSession } from '@/modules/customer/ui/start-session';
import { Icon } from '@/shared/ui/icon';

// Shopper copy: the legacy Amasty button ("Continuar con {label}") and the sign-in form errors.
const FAILED = 'No pudimos iniciar sesión. Inténtalo de nuevo.';
const STORAGE_FAILED =
  'No pudimos guardar tu sesión. Revisa que tu navegador permita almacenamiento.';
/** How often an open popup is checked for being closed without an answer. */
const POPUP_WATCH_MS = 500;
const popupBlocked = (label: string) =>
  `Permite las ventanas emergentes de este sitio para continuar con ${label}.`;

interface SocialButtonsProps {
  /** From Magento; nothing renders when empty. */
  readonly buttons: readonly SocialLoginButton[];
  /** Where to go once signed in (already checked to be a path on this site). */
  readonly redirectTo: string;
  /** Where Amasty's "continue on create account" answer leads; the create-account page passes none. */
  readonly createAccountHref?: string;
}

/**
 * Amasty social login buttons (legacy `SocialAuthentication` in `popup` mode).
 * Opens the Magento login in a popup and takes the token it posts back only
 * from that popup and the button's origin, then stores the session like the
 * password sign-in.
 */
export function SocialButtons({ buttons, redirectTo, createAccountHref }: SocialButtonsProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const popup = useRef<{ window: Window; url: string; type: string } | null>(null);
  const watcher = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Stops listening to the current popup: after its answer, or once it closed without one. */
  function forgetPopup(): void {
    if (watcher.current) clearInterval(watcher.current);
    watcher.current = null;
    popup.current = null;
  }

  useEffect(() => {
    async function onMessage(event: MessageEvent): Promise<void> {
      const opened = popup.current;
      if (!opened || event.source !== opened.window) return;
      const message = parsePopupMessage(event.data);
      if (!message) return;
      // One answer per popup: a second post from the same window is ignored.
      forgetPopup();
      if (!isTrustedPopupMessage(event, opened.window, opened.url)) {
        // Our popup answered from another origin than its button url (e.g. a
        // www redirect): the token is not used, but the shopper is told.
        setError(FAILED);
        return;
      }

      if (message.kind === 'error') {
        if (message.redirectToCreateAccount && createAccountHref) {
          window.location.assign(createAccountHref);
          return;
        }
        setError(message.message ?? FAILED);
        return;
      }

      setBusy(opened.type);
      const fail = (copy: string) => {
        setError(copy);
        setBusy(null);
      };
      try {
        const result = await completeSocialSignInAction({
          token: message.token,
          guestCartId: browserCartStorage.readCartId(),
        });
        if (result.status !== 'signed_in') return fail(FAILED);
        if (!startSession(result)) return fail(STORAGE_FAILED);
        // Stays busy: the tiles must not start a second sign-in while the next page loads.
        window.location.assign(redirectTo);
      } catch {
        fail(FAILED);
      }
    }

    const listener = (event: MessageEvent) => void onMessage(event);
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [redirectTo, createAccountHref]);

  // Only unmounting forgets the popup: a new listener for changed props keeps it.
  useEffect(() => () => forgetPopup(), []);

  if (buttons.length === 0) return null;

  function openPopup(button: SocialLoginButton): void {
    setError(null);
    forgetPopup();
    const opened = window.open(popupUrl(button.url), button.type, popupFeatures(window));
    if (!opened) {
      setError(popupBlocked(button.label));
      return;
    }
    popup.current = { window: opened, url: button.url, type: button.type };
    // Amasty posts its answer and then closes the popup, so a closed popup is
    // forgotten one tick later: its answer, already queued, arrives first.
    let closedSeen = false;
    watcher.current = setInterval(() => {
      if (!opened.closed) return;
      if (closedSeen) forgetPopup();
      closedSeen = true;
    }, POPUP_WATCH_MS);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Figma "Inicia sesión" (node 1957:436): a rule on each side of the label. */}
      <div className="flex items-center gap-3 text-[13px] leading-[18px] font-medium text-ds-text-secondary">
        <span aria-hidden="true" className="h-px flex-1 bg-ds-border" />
        <span>o continúa con</span>
        <span aria-hidden="true" className="h-px flex-1 bg-ds-border" />
      </div>
      <FormError message={error} />
      <div className="flex gap-3">
        {buttons.map((button) => (
          <button
            key={button.type}
            type="button"
            // The tile shows the network name only; the accessible name keeps the legacy wording.
            aria-label={`Continuar con ${button.label}`}
            aria-busy={busy === button.type || undefined}
            disabled={busy !== null}
            onClick={() => openPopup(button)}
            className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md border border-ds-border bg-ds-surface py-[11px] text-sm leading-5 font-semibold text-ds-text hover:bg-ds-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === button.type ? (
              // The DS Button spinner glyph, in place of the mark while this network signs in.
              <Icon
                name="loader"
                size={18}
                className="shrink-0 animate-spin motion-reduce:animate-[spin_2s_linear_infinite]"
              />
            ) : (
              <BrandMark type={button.type} />
            )}
            <span className="truncate">{button.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Google mark from the Figma design; Facebook from the icon catalog; other networks show the label only. */
function BrandMark({ type }: { readonly type: string }) {
  if (type === 'google') {
    return (
      <Image src="/images/layout/google.svg" alt="" width={18} height={18} className="shrink-0" />
    );
  }
  if (type === 'facebook') return <Icon name="facebook" size={18} className="shrink-0" />;
  return null;
}
