// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({ getCustomerAction: vi.fn(), signOutAction: vi.fn() }));
vi.mock('@/modules/customer/ui/customer-actions', () => actions);

const { AccountAction } = await import('@/modules/customer/ui/account-action.client');

const KEY = (name: string) => `M2_VENIA_BROWSER_PERSISTENCE__${name}`;
const CUSTOMER = { email: 'ana@b.mx', firstName: 'Ana', lastName: 'Pérez', isSubscribed: false };
const reload = vi.fn();

function storeSession() {
  localStorage.setItem(
    KEY('signin_token'),
    JSON.stringify({ value: '"jwt"', timeStored: Date.now(), ttl: 3600 }),
  );
  localStorage.setItem(KEY('cartId'), JSON.stringify({ value: '"cart"', timeStored: Date.now() }));
  localStorage.setItem(KEY('shipping_address'), '{}');
}

async function renderAction() {
  await act(async () => {
    render(<AccountAction signInHref="/sign-in" />);
  });
}

beforeEach(() => {
  Object.values(actions).forEach((mock) => mock.mockReset());
  reload.mockReset();
  localStorage.clear();
  Object.defineProperty(window, 'location', { value: { reload }, configurable: true });
});
afterEach(cleanup);

describe('AccountAction', () => {
  it('is the sign-in link for a guest and never calls Magento', async () => {
    await renderAction();
    expect(screen.getByRole('link', { name: 'Mi cuenta' }).getAttribute('href')).toBe('/sign-in');
    expect(actions.getCustomerAction).not.toHaveBeenCalled();
  });

  it('turns into the account menu with the customer name once Magento answers', async () => {
    storeSession();
    actions.getCustomerAction.mockResolvedValue({ status: 'ok', customer: CUSTOMER });
    await renderAction();
    expect(actions.getCustomerAction).toHaveBeenCalledWith({ token: 'jwt' });

    const trigger = screen.getByRole('button', { name: 'Mi cuenta' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Ana Pérez')).toBeTruthy();
    expect(screen.getByText('ana@b.mx')).toBeTruthy();
    expect(screen.getByText('AP')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Órdenes y facturación' }).getAttribute('href')).toBe(
      '/my-account/order-history',
    );
    expect(screen.getAllByRole('link')).toHaveLength(7);
  });

  it('closes with Escape and when clicking outside', async () => {
    storeSession();
    actions.getCustomerAction.mockResolvedValue({ status: 'ok', customer: CUSTOMER });
    await renderAction();
    const trigger = screen.getByRole('button', { name: 'Mi cuenta' });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the menu, without the name, when the customer read fails', async () => {
    storeSession();
    actions.getCustomerAction.mockResolvedValue({ status: 'failed' });
    await renderAction();
    fireEvent.click(screen.getByRole('button', { name: 'Mi cuenta' }));
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
    expect(screen.queryByText('ana@b.mx')).toBeNull();
  });

  it('drops a token Magento rejects and shows the sign-in link', async () => {
    storeSession();
    actions.getCustomerAction.mockResolvedValue({ status: 'not_authorized' });
    await renderAction();
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toBeTruthy();
    expect(localStorage.getItem(KEY('signin_token'))).toBeNull();
    expect(localStorage.getItem(KEY('cartId'))).not.toBeNull();
  });

  it('signs out like peregrine: revoke, clear token, checkout data and cart, reload', async () => {
    storeSession();
    actions.getCustomerAction.mockResolvedValue({ status: 'ok', customer: CUSTOMER });
    actions.signOutAction.mockResolvedValue({ status: 'signed_out' });
    await renderAction();
    fireEvent.click(screen.getByRole('button', { name: 'Mi cuenta' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    });
    expect(actions.signOutAction).toHaveBeenCalledWith({ token: 'jwt' });
    expect(localStorage.length).toBe(0);
    expect(reload).toHaveBeenCalled();
  });

  it('signs out locally even when the revoke call throws', async () => {
    storeSession();
    actions.getCustomerAction.mockResolvedValue({ status: 'ok', customer: CUSTOMER });
    actions.signOutAction.mockRejectedValue(new Error('network'));
    await renderAction();
    fireEvent.click(screen.getByRole('button', { name: 'Mi cuenta' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    });
    expect(localStorage.length).toBe(0);
    expect(reload).toHaveBeenCalled();
  });
});
