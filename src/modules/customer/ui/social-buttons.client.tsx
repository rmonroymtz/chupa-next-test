'use client';

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
import { Button } from '@/shared/ui/button';

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
      try {
        const result = await completeSocialSignInAction({
          token: message.token,
          guestCartId: browserCartStorage.readCartId(),
        });
        if (result.status !== 'signed_in') {
          setError(FAILED);
          return;
        }
        if (!startSession(result)) {
          setError(STORAGE_FAILED);
          return;
        }
        window.location.assign(redirectTo);
      } catch {
        setError(FAILED);
      } finally {
        setBusy(null);
      }
    }

    const listener = (event: MessageEvent) => void onMessage(event);
    window.addEventListener('message', listener);
    return () => {
      window.removeEventListener('message', listener);
      forgetPopup();
    };
  }, [redirectTo, createAccountHref]);

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
    <div className="mt-6 flex flex-col gap-3">
      <div className="flex items-center gap-3 text-sm text-ds-text-secondary">
        <span className="h-px flex-1 bg-ds-border" />
        <span>o</span>
        <span className="h-px flex-1 bg-ds-border" />
      </div>
      <FormError message={error} />
      {buttons.map((button) => (
        <Button
          key={button.type}
          type="button"
          variant="secondary"
          size="lg"
          className="w-full"
          loading={busy === button.type}
          disabled={busy !== null}
          onClick={() => openPopup(button)}
        >
          <BrandMark type={button.type} />
          {`Continuar con ${button.label}`}
        </Button>
      ))}
    </div>
  );
}

/** Google and Facebook marks; other networks show the label only. */
function BrandMark({ type }: { readonly type: string }) {
  if (type === 'google') {
    return (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
        />
        <path
          fill="#FF3D00"
          d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
        />
      </svg>
    );
  }
  if (type === 'facebook') {
    return (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
        <path
          fill="#1877F2"
          d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"
        />
      </svg>
    );
  }
  return null;
}
