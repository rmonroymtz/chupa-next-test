// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({ completeSocialSignInAction: vi.fn() }));
vi.mock('@/modules/customer/ui/social-login-actions', () => actions);

const { SocialButtons } = await import('@/modules/customer/ui/social-buttons.client');

const CART_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__cartId';
const TOKEN_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__signin_token';
const GOOGLE = {
  type: 'google',
  label: 'Google',
  url: 'https://m.test/amsociallogin/social/login/?type=google',
};
const FACEBOOK = {
  type: 'facebook',
  label: 'Facebook',
  url: 'https://m.test/amsociallogin/social/login/?type=facebook',
};
const assign = vi.fn();
const open = vi.fn();
let popup: Window;

function openGooglePopup() {
  fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
}

async function post(data: unknown, init: { origin?: string; source?: Window } = {}) {
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data,
        origin: init.origin ?? 'https://m.test',
        source: init.source ?? popup,
      }),
    );
  });
}

beforeEach(() => {
  actions.completeSocialSignInAction.mockReset();
  assign.mockReset();
  localStorage.clear();
  const frame = document.createElement('iframe');
  document.body.appendChild(frame);
  popup = frame.contentWindow as Window;
  open.mockReset().mockReturnValue(popup);
  Object.defineProperty(window, 'location', {
    // `href` too: next/image (the Google mark) reads it to resolve the image url.
    value: { assign, origin: 'https://shop.test', href: 'https://shop.test/sign-in' },
    configurable: true,
  });
  Object.defineProperty(window, 'open', { value: open, configurable: true });
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('SocialButtons', () => {
  const props = { redirectTo: '/order-history', createAccountHref: '/create-account?from=%2Fx' };

  it('renders nothing without buttons', () => {
    const { container } = render(<SocialButtons buttons={[]} {...props} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the separator and one button per network', () => {
    render(<SocialButtons buttons={[GOOGLE, FACEBOOK]} {...props} />);
    expect(screen.getByText('o continúa con')).toBeTruthy();
    // The tiles show the network name; the accessible name keeps "Continuar con …".
    expect(screen.getByRole('button', { name: 'Continuar con Google' }).textContent).toBe('Google');
    expect(screen.getByRole('button', { name: 'Continuar con Facebook' })).toBeTruthy();
  });

  it('opens the Amasty popup asking for a new token', () => {
    render(<SocialButtons buttons={[GOOGLE]} {...props} />);
    openGooglePopup();
    expect(open).toHaveBeenCalledWith(
      `${GOOGLE.url}&isAjax=true&generateToken=true`,
      'google',
      expect.stringMatching(/^width=500,height=420,left=-?\d+,top=-?\d+$/),
    );
  });

  it('signs in with the posted token and the guest cart, stores the PWA session and redirects', async () => {
    localStorage.setItem(
      CART_KEY,
      JSON.stringify({ value: JSON.stringify('guest-cart'), timeStored: Date.now() }),
    );
    actions.completeSocialSignInAction.mockResolvedValue({
      status: 'signed_in',
      token: 'social.jwt',
      cartId: 'customer-cart',
      customer: null,
    });
    render(<SocialButtons buttons={[GOOGLE]} {...props} />);
    openGooglePopup();
    await post({ result: 1, token: 'social.jwt', messages: [] });
    expect(actions.completeSocialSignInAction).toHaveBeenCalledWith({
      token: 'social.jwt',
      guestCartId: 'guest-cart',
    });
    expect(JSON.parse(JSON.parse(localStorage.getItem(TOKEN_KEY) ?? '{}').value)).toBe(
      'social.jwt',
    );
    expect(JSON.parse(JSON.parse(localStorage.getItem(CART_KEY) ?? '{}').value)).toBe(
      'customer-cart',
    );
    expect(assign).toHaveBeenCalledWith('/order-history');
  });

  it('ignores a message from another window, another origin, or before a popup is opened', async () => {
    render(<SocialButtons buttons={[GOOGLE]} {...props} />);
    await post({ result: 1, token: 'early.jwt' });
    openGooglePopup();
    await post({ result: 1, token: 'other.jwt' }, { source: window });
    await post({ result: 1, token: 'evil.jwt' }, { origin: 'https://evil.test' });
    expect(actions.completeSocialSignInAction).not.toHaveBeenCalled();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it('shows an error when the server rejects the token, and stays on the page', async () => {
    actions.completeSocialSignInAction.mockResolvedValue({ status: 'failed' });
    render(<SocialButtons buttons={[GOOGLE]} {...props} />);
    openGooglePopup();
    await post({ result: 1, token: 'social.jwt' });
    expect(screen.getByRole('alert').textContent).toBe(
      'No pudimos iniciar sesión. Inténtalo de nuevo.',
    );
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it('shows the Amasty message, or the generic error without one', async () => {
    render(<SocialButtons buttons={[GOOGLE]} {...props} />);
    openGooglePopup();
    await post({ result: 0, messages: ['No pudimos obtener tu correo de Google.'] });
    expect(screen.getByRole('alert').textContent).toBe('No pudimos obtener tu correo de Google.');
    // One answer per popup: the next one needs a new popup.
    openGooglePopup();
    await post({ result: 0, messages: [] });
    expect(screen.getByRole('alert').textContent).toBe(
      'No pudimos iniciar sesión. Inténtalo de nuevo.',
    );
    expect(actions.completeSocialSignInAction).not.toHaveBeenCalled();
  });

  it('continues on create account when Amasty asks for it, and only where that link is given', async () => {
    const view = render(<SocialButtons buttons={[GOOGLE]} {...props} />);
    openGooglePopup();
    await post({ result: 0, messages: ['x'], redirect_data: { redirectWithError: 1 } });
    expect(assign).toHaveBeenCalledWith('/create-account?from=%2Fx');
    view.unmount();

    assign.mockReset();
    render(<SocialButtons buttons={[GOOGLE]} redirectTo="/my-account" />);
    openGooglePopup();
    await post({ result: 0, messages: ['x'], redirect_data: { redirectWithError: 1 } });
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('x');
  });

  it('says the sign-in failed when the popup answers from another origin, without using the token', async () => {
    render(<SocialButtons buttons={[GOOGLE]} {...props} />);
    openGooglePopup();
    await post({ result: 1, token: 'social.jwt' }, { origin: 'https://www.m.test' });
    expect(screen.getByRole('alert').textContent).toBe(
      'No pudimos iniciar sesión. Inténtalo de nuevo.',
    );
    expect(actions.completeSocialSignInAction).not.toHaveBeenCalled();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('forgets a popup closed without an answer, quietly', async () => {
    vi.useFakeTimers();
    try {
      render(<SocialButtons buttons={[GOOGLE]} {...props} />);
      openGooglePopup();
      Object.defineProperty(popup, 'closed', { value: true, configurable: true });
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      await post({ result: 0, messages: ['late'] });
      expect(screen.queryByRole('alert')).toBeNull();
      expect(actions.completeSocialSignInAction).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('still takes an answer that arrives right after the popup closed', async () => {
    vi.useFakeTimers();
    try {
      render(<SocialButtons buttons={[GOOGLE]} {...props} />);
      openGooglePopup();
      Object.defineProperty(popup, 'closed', { value: true, configurable: true });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      await post({ result: 0, messages: ['Respuesta tardía'] });
      expect(screen.getByRole('alert').textContent).toBe('Respuesta tardía');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps listening to an open popup when the page props change', async () => {
    const view = render(<SocialButtons buttons={[GOOGLE]} {...props} />);
    openGooglePopup();
    view.rerender(<SocialButtons buttons={[GOOGLE]} {...props} redirectTo="/quotes" />);
    await post({ result: 0, messages: ['Después del cambio'] });
    expect(screen.getByRole('alert').textContent).toBe('Después del cambio');
  });

  it('marks the network in progress and disables every tile while the server checks the token', async () => {
    let finish: (value: unknown) => void = () => undefined;
    actions.completeSocialSignInAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<SocialButtons buttons={[GOOGLE, FACEBOOK]} {...props} />);
    openGooglePopup();
    await post({ result: 1, token: 'social.jwt' });
    const google = screen.getByRole('button', {
      name: 'Continuar con Google',
    }) as HTMLButtonElement;
    const facebook = screen.getByRole('button', {
      name: 'Continuar con Facebook',
    }) as HTMLButtonElement;
    expect(google.getAttribute('aria-busy')).toBe('true');
    expect(facebook.getAttribute('aria-busy')).toBeNull();
    expect(google.disabled && facebook.disabled).toBe(true);
    await act(async () => {
      finish({ status: 'failed' });
    });
    expect(google.getAttribute('aria-busy')).toBeNull();
    expect(google.disabled || facebook.disabled).toBe(false);
  });

  it('asks to allow pop-ups when the browser blocks the popup', () => {
    open.mockReturnValue(null);
    render(<SocialButtons buttons={[GOOGLE]} {...props} />);
    openGooglePopup();
    expect(screen.getByRole('alert').textContent).toBe(
      'Permite las ventanas emergentes de este sitio para continuar con Google.',
    );
  });
});
