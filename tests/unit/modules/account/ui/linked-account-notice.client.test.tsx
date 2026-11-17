// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountProfileProvider } from '@/modules/account/ui/account-profile';
import { EditAccountInformationForm } from '@/modules/account/ui/edit-account-information-form';
import { encodePersisted } from '@/modules/cart/domain/browser-persistence';
import type { CustomerProfile } from '@/modules/customer/application/ports';

const actions = vi.hoisted(() => ({
  updateProfileAction: vi.fn(),
  requestPasswordResetAction: vi.fn(),
}));
vi.mock('@/modules/customer/ui/customer-actions', () => actions);
const social = vi.hoisted(() => ({ getLinkedSocialAccountsAction: vi.fn() }));
vi.mock('@/modules/customer/ui/social-login-actions', () => social);

const recaptcha = vi.hoisted(() => ({ forms: [] as string[] }));
vi.mock('@/modules/customer/ui/use-recaptcha', () => ({
  useRecaptcha: (form: string) => {
    recaptcha.forms.push(form);
    return async (action: string) => `rc-${form}-${action}`;
  },
}));
vi.mock('@/modules/account/ui/browser-redirect', () => ({ redirectBrowser: vi.fn() }));

const TOKEN_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__signin_token';
const PROFILE: CustomerProfile = {
  firstName: 'Ana',
  middleName: '',
  lastName: 'Pérez',
  email: 'ana@example.mx',
  phone: null,
  photoUrl: null,
};
const NOTICE_TEXT =
  'Tu cuenta no tiene contraseña propia establecida. Podemos enviarte un correo para que crees una.';

async function renderForm() {
  window.localStorage.setItem(TOKEN_KEY, encodePersisted('a.b.c', Date.now()));
  await act(async () => {
    render(
      <AccountProfileProvider profile={PROFILE} token="a.b.c">
        <EditAccountInformationForm />
      </AccountProfileProvider>,
    );
  });
}

async function sendResetEmail() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Enviar correo de restablecimiento' }));
  });
}

beforeEach(() => {
  actions.updateProfileAction.mockReset();
  actions.requestPasswordResetAction.mockReset();
  social.getLinkedSocialAccountsAction.mockReset();
  recaptcha.forms = [];
  window.localStorage.clear();
});
afterEach(cleanup);

describe('linked social accounts notice', () => {
  it('replaces the password change for a customer with linked networks', async () => {
    social.getLinkedSocialAccountsAction.mockResolvedValue({
      status: 'ok',
      accounts: [
        { type: 'google', name: 'Google' },
        { type: 'facebook', name: 'Facebook' },
      ],
    });
    await renderForm();
    expect(social.getLinkedSocialAccountsAction).toHaveBeenCalledWith({ token: 'a.b.c' });
    expect(screen.getByText('Cuenta vinculada con Google y Facebook')).toBeTruthy();
    expect(screen.getByText(NOTICE_TEXT)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cambiar contraseña' })).toBeNull();
    expect(screen.queryByText('••••••••')).toBeNull();
  });

  it('sends the reset email with the CUSTOMER_FORGOT_PASSWORD token and confirms it', async () => {
    social.getLinkedSocialAccountsAction.mockResolvedValue({
      status: 'ok',
      accounts: [{ type: 'google', name: 'Google' }],
    });
    actions.requestPasswordResetAction.mockResolvedValue({ status: 'sent' });
    await renderForm();
    expect(screen.getByText('Cuenta vinculada con Google')).toBeTruthy();
    await sendResetEmail();
    expect(recaptcha.forms).toContain('CUSTOMER_FORGOT_PASSWORD');
    expect(actions.requestPasswordResetAction).toHaveBeenCalledWith({
      email: 'ana@example.mx',
      recaptchaToken: 'rc-CUSTOMER_FORGOT_PASSWORD-forgotPassword',
    });
    const status = screen.getByRole('status');
    expect(status.textContent).toBe(
      '✓ Enviamos las instrucciones a ana@example.mx. Revisa tu bandeja de entrada y spam.',
    );
    expect(screen.queryByRole('button', { name: 'Enviar correo de restablecimiento' })).toBeNull();
  });

  it('shows the error and keeps the button when the email fails', async () => {
    social.getLinkedSocialAccountsAction.mockResolvedValue({
      status: 'ok',
      accounts: [{ type: 'google', name: 'Google' }],
    });
    actions.requestPasswordResetAction.mockResolvedValue({ status: 'failed' });
    await renderForm();
    await sendResetEmail();
    expect(screen.getByRole('alert').textContent).toBe(
      'No pudimos enviar el correo. Intenta de nuevo.',
    );
    expect(screen.getByRole('button', { name: 'Enviar correo de restablecimiento' })).toBeTruthy();
  });

  it('keeps the password change when there are no linked networks or they cannot be read', async () => {
    for (const result of [
      { status: 'ok', accounts: [] },
      { status: 'failed' },
      { status: 'not_authorized' },
    ]) {
      social.getLinkedSocialAccountsAction.mockResolvedValue(result);
      await renderForm();
      expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeTruthy();
      expect(screen.queryByText(NOTICE_TEXT)).toBeNull();
      cleanup();
    }
  });
});
