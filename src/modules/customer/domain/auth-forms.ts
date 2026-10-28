/**
 * Pure rules of the auth screens, from the legacy PWA forms
 * (venia-ui `SignInPage`, `CreateAccount`, `PasswordRequirements`).
 */

const AUTH_PATHS = ['/sign-in', '/create-account', '/forgot-password'];

/**
 * Where to go after signing in: the `from` query value when it is a path on
 * this site (never an external url, never another auth screen), else the
 * fallback. The PWA uses `history.state.from`; the query keeps it across the
 * three screens and full-page navigations.
 */
export function resolveRedirect(from: string | undefined | null, fallback: string): string {
  if (!from || !from.startsWith('/') || from.startsWith('//')) return fallback;
  if (/[\\\u0000-\u001f]/.test(from)) return fallback;
  const path = from.split(/[?#]/)[0] ?? '';
  if (AUTH_PATHS.includes(path)) return fallback;
  return from;
}

export interface PasswordRequirements {
  readonly lowercase: boolean;
  readonly uppercase: boolean;
  readonly digit: boolean;
  readonly minLength: boolean;
}

/** The four requirements the legacy form lists under the password field. */
export function passwordRequirements(password: string): PasswordRequirements {
  return {
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
    minLength: password.length >= 8,
  };
}

export function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** Links between the auth screens keep a valid `from`, so the shopper lands where they started. */
export function authHref(path: string, from: string | undefined | null): string {
  const safe = resolveRedirect(from, '');
  return safe === '' ? path : `${path}?from=${encodeURIComponent(safe)}`;
}
