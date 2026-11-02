// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountProfileProvider } from '@/modules/account/ui/account-profile';
import { EditAccountInformationForm } from '@/modules/account/ui/edit-account-information-form';
import { encodePersisted } from '@/modules/cart/domain/browser-persistence';
import type { CustomerProfile } from '@/modules/customer/application/ports';

const actions = vi.hoisted(() => ({ updateProfileAction: vi.fn() }));
vi.mock('@/modules/customer/ui/customer-actions', () => actions);

const recaptcha = vi.hoisted(() => ({ form: '', token: 'rc-token' }));
vi.mock('@/modules/customer/ui/use-recaptcha', () => ({
  useRecaptcha: (form: string) => {
    recaptcha.form = form;
    return async () => recaptcha.token;
  },
}));

const redirect = vi.hoisted(() => vi.fn());
vi.mock('@/modules/account/ui/browser-redirect', () => ({ redirectBrowser: redirect }));

const TOKEN_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__signin_token';
const PROFILE: CustomerProfile = {
  firstName: 'Ana',
  middleName: '',
  lastName: 'Pérez',
  email: 'ana@example.mx',
  phone: '6643119682',
  photoUrl: null,
};

function renderForm() {
  window.localStorage.setItem(TOKEN_KEY, encodePersisted('a.b.c', Date.now()));
  return render(
    <AccountProfileProvider profile={PROFILE} token="a.b.c">
      <EditAccountInformationForm />
    </AccountProfileProvider>,
  );
}

const field = (name: string) => screen.getByLabelText(name, { exact: true }) as HTMLInputElement;
const type = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

beforeEach(() => {
  actions.updateProfileAction.mockReset();
  redirect.mockReset();
  window.localStorage.clear();
});
afterEach(cleanup);

describe('EditAccountInformationForm', () => {
  it('prefills the fields and shows the phone prefix and the email hint', () => {
    renderForm();
    expect(screen.getByRole('heading', { level: 1, name: 'EDITAR DATOS' })).toBeTruthy();
    expect(field('Nombre').value).toBe('Ana');
    expect(field('Apellido').value).toBe('Pérez');
    expect(field('Correo electrónico').value).toBe('ana@example.mx');
    expect(field('Teléfono').value).toBe('6643119682');
    expect(screen.getByText('🇲🇽 +52')).toBeTruthy();
    expect(field('Teléfono').getAttribute('placeholder')).toBe('10 dígitos');
    expect(
      screen.getByText(
        'Para cambiar tu correo deberás confirmar tu contraseña en la sección Seguridad.',
      ),
    ).toBeTruthy();
  });

  it('goes back to the profile without a request when nothing changed', async () => {
    renderForm();
    save();
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/my-account/account-information'));
    expect(actions.updateProfileAction).not.toHaveBeenCalled();
  });

  it('shows the required message and sends nothing for an empty name', async () => {
    renderForm();
    type('Nombre', ' ');
    save();
    expect(await screen.findByText('Este campo es obligatorio')).toBeTruthy();
    expect(actions.updateProfileAction).not.toHaveBeenCalled();
  });

  it('keeps only digits in the phone, at most ten', () => {
    renderForm();
    type('Teléfono', '(55) 1234-5678 99');
    expect(field('Teléfono').value).toBe('5512345678');
  });

  it('sends a phone change with the token and goes back to the profile', async () => {
    actions.updateProfileAction.mockResolvedValue({ status: 'saved' });
    renderForm();
    type('Teléfono', '5512345678');
    save();

    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/my-account/account-information'));
    expect(actions.updateProfileAction).toHaveBeenCalledWith({
      token: 'a.b.c',
      phone: '5512345678',
      recaptchaToken: null,
    });
  });

  it('asks for the password section before changing the email', async () => {
    renderForm();
    type('Correo electrónico', 'nueva@example.mx');
    save();
    await waitFor(() =>
      expect(field('Correo electrónico').getAttribute('aria-invalid')).toBe('true'),
    );
    expect(actions.updateProfileAction).not.toHaveBeenCalled();
  });

  it('changes the email with the current password from the Seguridad section', async () => {
    actions.updateProfileAction.mockResolvedValue({ status: 'saved' });
    renderForm();
    expect(screen.getByText('••••••••')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    type('Correo electrónico', 'nueva@example.mx');
    type('Contraseña actual', 'Current1!');
    save();

    await waitFor(() => expect(redirect).toHaveBeenCalled());
    expect(actions.updateProfileAction).toHaveBeenCalledWith({
      token: 'a.b.c',
      identity: {
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'nueva@example.mx',
        password: 'Current1!',
      },
      recaptchaToken: null,
    });
  });

  it('changes the password with the CUSTOMER_EDIT reCAPTCHA token', async () => {
    actions.updateProfileAction.mockResolvedValue({ status: 'saved' });
    renderForm();
    expect(recaptcha.form).toBe('CUSTOMER_EDIT');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    type('Contraseña actual', 'Current1!');
    type('Nueva contraseña', 'Brand-new2!');
    save();

    await waitFor(() => expect(redirect).toHaveBeenCalled());
    expect(actions.updateProfileAction).toHaveBeenCalledWith({
      token: 'a.b.c',
      password: { current: 'Current1!', next: 'Brand-new2!' },
      recaptchaToken: 'rc-token',
    });
  });

  it('shows the password rules before sending', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    type('Contraseña actual', 'Current1!');
    type('Nueva contraseña', 'abc');
    save();
    expect(await screen.findByText('Debe contener al menos 8 caracter(es).')).toBeTruthy();

    type('Nueva contraseña', 'abcdefgh');
    save();
    expect(
      await screen.findByText(
        'Una contraseña debe contener al menos 3 de los siguientes: minúsculas, mayúsculas, dígitos, caracteres especiales.',
      ),
    ).toBeTruthy();
    expect(actions.updateProfileAction).not.toHaveBeenCalled();
  });

  it('toggles the password visibility and cancels the password change', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(field('Contraseña actual').type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Ver contraseña' }));
    expect(field('Contraseña actual').type).toBe('text');
    expect(field('Nueva contraseña').type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(field('Contraseña actual').type).toBe('password');

    type('Contraseña actual', 'something');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar cambio de contraseña' }));
    expect(screen.getByText('••••••••')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(field('Contraseña actual').value).toBe('');
  });

  it.each([
    [
      'email_taken',
      'Esta dirección de correo ya está registrada. Por favor, utilice otra dirección.',
    ],
    ['wrong_password', 'La contraseña actual no es correcta.'],
    [
      'weak_password',
      'La contraseña debe contener: minúsculas, MAYÚSCULAS, números (0-9) y símbolos (!@#$).',
    ],
    ['failed', 'No pudimos guardar tus cambios. Inténtalo de nuevo.'],
  ])('shows the %s error and stays on the form', async (reason, message) => {
    actions.updateProfileAction.mockResolvedValue({ status: 'error', reason, partial: false });
    renderForm();
    type('Teléfono', '5512345678');
    save();

    expect((await screen.findByRole('alert')).textContent).toBe(message);
    expect(redirect).not.toHaveBeenCalled();
    expect(field('Teléfono').value).toBe('5512345678');
  });

  it('says so when only part of the changes were saved', async () => {
    actions.updateProfileAction.mockResolvedValue({
      status: 'error',
      reason: 'wrong_password',
      partial: true,
    });
    renderForm();
    type('Teléfono', '5512345678');
    save();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Guardamos una parte de tus cambios, pero no pudimos guardar el resto. Revisa tus datos e inténtalo de nuevo.',
    );
  });

  it('drops a token Magento rejects and sends the shopper to sign in', async () => {
    actions.updateProfileAction.mockResolvedValue({ status: 'not_authorized' });
    renderForm();
    type('Teléfono', '5512345678');
    save();

    await waitFor(() =>
      expect(redirect).toHaveBeenCalledWith(
        '/sign-in?from=%2Fmy-account%2Fedit-account-information',
      ),
    );
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('links "Cancelar" back to the profile', () => {
    renderForm();
    expect(screen.getByRole('link', { name: 'Cancelar' }).getAttribute('href')).toBe(
      '/my-account/account-information',
    );
  });
});
