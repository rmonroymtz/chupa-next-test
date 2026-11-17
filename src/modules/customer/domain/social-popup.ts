/**
 * The Amasty social login popup (legacy `useSocButtons` and `useSignInEvent`).
 * The page opens the Magento login url in a popup; Magento then posts
 * `{ result, token, messages, redirect_data }` to the opener.
 */

const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 420;

/** Asks Amasty for the ajax answer that posts a new customer token to the opener. */
export function popupUrl(buttonUrl: string): string {
  const separator = buttonUrl.includes('?') ? '&' : '?';
  return `${buttonUrl}${separator}isAjax=true&generateToken=true`;
}

export interface WindowMetrics {
  readonly screenX: number;
  readonly screenY: number;
  readonly outerWidth: number;
  readonly outerHeight: number;
}

/** A 500x420 popup centered horizontally and a bit above the middle, as the legacy. */
export function popupFeatures({
  screenX,
  screenY,
  outerWidth,
  outerHeight,
}: WindowMetrics): string {
  const left = Math.trunc(screenX + (outerWidth - POPUP_WIDTH) / 2);
  const top = Math.trunc(screenY + (outerHeight - POPUP_HEIGHT) / 2.5);
  return `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top}`;
}

export type PopupMessage =
  | { readonly kind: 'signed_in'; readonly token: string }
  | {
      readonly kind: 'error';
      /** Amasty's first message; null when it sent none. */
      readonly message: string | null;
      /** Amasty asks to continue on the create-account form (legacy `redirectWithError`). */
      readonly redirectToCreateAccount: boolean;
    };

/** Null for any message that is not an Amasty answer. */
export function parsePopupMessage(data: unknown): PopupMessage | null {
  if (!data || typeof data !== 'object') return null;
  const { result, token, messages, redirect_data: redirect } = data as Record<string, unknown>;
  if (result === 1) {
    return typeof token === 'string' && token !== '' ? { kind: 'signed_in', token } : null;
  }
  if (result !== 0) return null;
  const first = Array.isArray(messages) ? messages[0] : undefined;
  const redirectWithError =
    redirect && typeof redirect === 'object'
      ? (redirect as Record<string, unknown>).redirectWithError
      : undefined;
  return {
    kind: 'error',
    message: typeof first === 'string' && first.trim() !== '' ? first : null,
    redirectToCreateAccount: Boolean(redirectWithError),
  };
}

/**
 * A sign-in token is accepted only from the popup this page opened, served
 * from the origin of the button url. The legacy listener checked neither, so
 * any window could hand it a token.
 */
export function isTrustedPopupMessage(
  event: { readonly source: unknown; readonly origin: string },
  popup: Window | null,
  buttonUrl: string,
): boolean {
  if (!popup || event.source !== popup) return false;
  try {
    return event.origin === new URL(buttonUrl).origin;
  } catch {
    return false;
  }
}
