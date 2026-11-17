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
    value: { assign, origin: 'https://shop.test' },
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
    expect(screen.getByText('o')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeTruthy();
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

  it('asks to allow pop-ups when the browser blocks the popup', () => {
    open.mockReturnValue(null);
    render(<SocialButtons buttons={[GOOGLE]} {...props} />);
    openGooglePopup();
    expect(screen.getByRole('alert').textContent).toBe(
      'Permite las ventanas emergentes de este sitio para continuar con Google.',
    );
  });
});
