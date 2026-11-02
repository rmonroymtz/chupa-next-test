// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodePersisted } from '@/modules/cart/domain/browser-persistence';
import { AccountShell } from '@/modules/account/ui/account-shell.client';
import { useAccountProfile } from '@/modules/account/ui/account-profile';

const actions = vi.hoisted(() => ({ getCustomerProfileAction: vi.fn() }));
vi.mock('@/modules/customer/ui/customer-actions', () => actions);

const navigation = vi.hoisted(() => ({
  pathname: '/my-account',
  search: '',
}));
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

const redirect = vi.hoisted(() => vi.fn());
vi.mock('@/modules/account/ui/browser-redirect', () => ({ redirectBrowser: redirect }));

const TOKEN_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__signin_token';
const PROFILE = {
  firstName: 'Ana',
  middleName: '',
  lastName: 'Pérez',
  email: 'ana@example.mx',
  phone: null,
  photoUrl: null,
};

function storeToken(): void {
  window.localStorage.setItem(TOKEN_KEY, encodePersisted('a.b.c', Date.now()));
}

function Child() {
  const { profile } = useAccountProfile();
  return <p>Cuenta de {profile.email}</p>;
}

beforeEach(() => {
  actions.getCustomerProfileAction.mockReset();
  redirect.mockReset();
  window.localStorage.clear();
  navigation.pathname = '/my-account';
  navigation.search = '';
});
afterEach(cleanup);

describe('AccountShell', () => {
  it('sends a guest to the sign-in screen with the current url as `from`', async () => {
    navigation.pathname = '/my-account/address-book';
    navigation.search = 'page=2';
    render(
      <AccountShell>
        <Child />
      </AccountShell>,
    );

    await waitFor(() =>
      expect(redirect).toHaveBeenCalledWith(
        '/sign-in?from=%2Fmy-account%2Faddress-book%3Fpage%3D2',
      ),
    );
    expect(actions.getCustomerProfileAction).not.toHaveBeenCalled();
    expect(screen.queryByText(/Cuenta de/)).toBeNull();
  });

  it('shows the page with the profile for a signed-in shopper', async () => {
    storeToken();
    actions.getCustomerProfileAction.mockResolvedValue({ status: 'ok', profile: PROFILE });
    render(
      <AccountShell>
        <Child />
      </AccountShell>,
    );

    expect(await screen.findByText('Cuenta de ana@example.mx')).toBeTruthy();
    expect(actions.getCustomerProfileAction).toHaveBeenCalledWith({ token: 'a.b.c' });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('shows a loading state until Magento answers', async () => {
    storeToken();
    let finish: (value: unknown) => void = () => {};
    actions.getCustomerProfileAction.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(
      <AccountShell>
        <Child />
      </AccountShell>,
    );

    expect((await screen.findByRole('status')).textContent).toBe('Cargando tu cuenta…');
    finish({ status: 'ok', profile: PROFILE });
    expect(await screen.findByText('Cuenta de ana@example.mx')).toBeTruthy();
  });

  it('drops a token Magento rejects and sends the shopper to sign in', async () => {
    storeToken();
    actions.getCustomerProfileAction.mockResolvedValue({ status: 'not_authorized' });
    render(
      <AccountShell>
        <Child />
      </AccountShell>,
    );

    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/sign-in?from=%2Fmy-account'));
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('shows the legacy error when the profile cannot be read, keeping the session', async () => {
    storeToken();
    actions.getCustomerProfileAction.mockResolvedValue({ status: 'failed' });
    render(
      <AccountShell>
        <Child />
      </AccountShell>,
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Algo salió mal. Por favor, actualiza la página e inténtalo de nuevo.',
    );
    expect(redirect).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(TOKEN_KEY)).not.toBeNull();
  });

  it('renders the breadcrumb of the current path above the page', async () => {
    storeToken();
    navigation.pathname = '/my-account/support';
    actions.getCustomerProfileAction.mockResolvedValue({ status: 'ok', profile: PROFILE });
    render(
      <AccountShell>
        <Child />
      </AccountShell>,
    );
    await screen.findByText('Cuenta de ana@example.mx');

    const nav = screen.getByRole('navigation', { name: 'Ruta de navegación' });
    expect(within(nav).getByRole('link', { name: 'Mi cuenta' }).getAttribute('href')).toBe(
      '/my-account',
    );
    expect(within(nav).getByText('Atención a clientes').getAttribute('aria-current')).toBe('page');
  });
});
