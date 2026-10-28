// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  signInAction: vi.fn(),
  createAccountAction: vi.fn(),
  requestPasswordResetAction: vi.fn(),
  getRecaptchaConfigAction: vi.fn(),
}));
vi.mock('@/modules/customer/ui/customer-actions', () => actions);
const getToken = vi.hoisted(() => vi.fn());
vi.mock('@/modules/customer/ui/use-recaptcha', () => ({ useRecaptcha: () => getToken }));

const { SignInForm } = await import('@/modules/customer/ui/sign-in-form.client');
const { CreateAccountForm } = await import('@/modules/customer/ui/create-account-form.client');
const { ForgotPasswordForm } = await import('@/modules/customer/ui/forgot-password-form.client');

const CART_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__cartId';
const TOKEN_KEY = 'M2_VENIA_BROWSER_PERSISTENCE__signin_token';
const assign = vi.fn();
const signedIn = { status: 'signed_in', token: 'jwt', cartId: 'customer-cart', customer: null };

function type(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
async function submit(name: RegExp | string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

beforeEach(() => {
  Object.values(actions).forEach((mock) => mock.mockReset());
  getToken.mockReset().mockResolvedValue('rc-token');
  assign.mockReset();
  localStorage.clear();
  Object.defineProperty(window, 'location', { value: { assign }, configurable: true });
});
afterEach(cleanup);

describe('SignInForm', () => {
  const props = {
    redirectTo: '/my-account',
    createAccountHref: '/create-account',
    forgotPasswordHref: '/forgot-password',
  };

  it('requires both fields before reaching the server', async () => {
    render(<SignInForm {...props} />);
    await submit('Iniciar sesión');
    expect(screen.getAllByText('Este campo es obligatorio').length).toBeGreaterThanOrEqual(2);
    expect(actions.signInAction).not.toHaveBeenCalled();
  });

  it('signs in with the guest cart and reCAPTCHA token, stores the PWA session and redirects', async () => {
    localStorage.setItem(
      CART_KEY,
      JSON.stringify({ value: JSON.stringify('guest-cart'), timeStored: Date.now() }),
    );
    actions.signInAction.mockResolvedValue(signedIn);
    render(<SignInForm {...props} />);
    type(/Correo electrónico requerido/, ' a@b.mx ');
    type(/Contraseña requerida/, ' p w ');
    await submit('Iniciar sesión');

    expect(actions.signInAction).toHaveBeenCalledWith({
      email: 'a@b.mx',
      password: ' p w ',
      guestCartId: 'guest-cart',
      recaptchaToken: 'rc-token',
    });
    expect(JSON.parse(localStorage.getItem(TOKEN_KEY) ?? '{}')).toMatchObject({
      value: '"jwt"',
      ttl: 3600,
    });
    expect(JSON.parse(localStorage.getItem(CART_KEY) ?? '{}').value).toBe('"customer-cart"');
    expect(assign).toHaveBeenCalledWith('/my-account');
  });

  it('shows the Magento credentials message and does not redirect', async () => {
    actions.signInAction.mockResolvedValue({ status: 'invalid_credentials' });
    render(<SignInForm {...props} />);
    type(/Correo electrónico requerido/, 'a@b.mx');
    type(/Contraseña requerida/, 'bad');
    await submit('Iniciar sesión');
    expect((await screen.findByRole('alert')).textContent).toContain('incorrecto');
    expect(assign).not.toHaveBeenCalled();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('links to the other screens and toggles the password', () => {
    render(<SignInForm {...props} />);
    expect(screen.getByText('Olvidé mi contraseña').getAttribute('href')).toBe('/forgot-password');
    expect(screen.getByText('Crear cuenta').getAttribute('href')).toBe('/create-account');
    const field = screen.getByLabelText(/Contraseña requerida/);
    expect(field.getAttribute('type')).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(field.getAttribute('type')).toBe('text');
  });
});

describe('CreateAccountForm', () => {
  function fill() {
    type('Nombre *', ' Ana ');
    type('Apellido *', 'Pérez');
    type('Correo electrónico *', 'a@b.mx');
    type('Contraseña *', 'Pw1!aaaa');
  }

  it('validates names, email and password length', async () => {
    render(<CreateAccountForm redirectTo="/order-history" signInHref="/sign-in" />);
    type('Correo electrónico *', 'nope');
    type('Contraseña *', 'short');
    await submit('Crear cuenta');
    expect(screen.getAllByText('Este campo es obligatorio')).toHaveLength(2);
    expect(screen.getByText(/dirección de correo electrónico válida/)).toBeTruthy();
    expect(screen.getByText('Debe contener al menos 8 caracter(es).')).toBeTruthy();
    expect(actions.createAccountAction).not.toHaveBeenCalled();
  });

  it('creates the account, then signs in with a second reCAPTCHA token and redirects', async () => {
    actions.createAccountAction.mockResolvedValue({ status: 'created' });
    actions.signInAction.mockResolvedValue(signedIn);
    getToken.mockResolvedValueOnce('rc-create').mockResolvedValueOnce('rc-login');
    render(<CreateAccountForm redirectTo="/order-history" signInHref="/sign-in" />);
    fill();
    fireEvent.click(screen.getByLabelText('Suscribirse a noticias y actualizaciones'));
    await submit('Crear cuenta');

    expect(actions.createAccountAction).toHaveBeenCalledWith({
      email: 'a@b.mx',
      firstName: 'Ana',
      lastName: 'Pérez',
      password: 'Pw1!aaaa',
      isSubscribed: true,
      recaptchaToken: 'rc-create',
    });
    expect(actions.signInAction).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.mx', recaptchaToken: 'rc-login' }),
    );
    expect(assign).toHaveBeenCalledWith('/order-history');
  });

  it('maps email_taken and weak_password to the legacy messages', async () => {
    actions.createAccountAction.mockResolvedValueOnce({ status: 'email_taken' });
    render(<CreateAccountForm redirectTo="/order-history" signInHref="/sign-in" />);
    fill();
    await submit('Crear cuenta');
    expect((await screen.findByRole('alert')).textContent).toContain('ya está registrada');
    actions.createAccountAction.mockResolvedValueOnce({ status: 'weak_password' });
    await submit('Crear cuenta');
    expect((await screen.findByRole('alert')).textContent).toContain('minúsculas, MAYÚSCULAS');
    expect(actions.signInAction).not.toHaveBeenCalled();
  });

  it('tells the shopper when the account exists but the session did not start', async () => {
    actions.createAccountAction.mockResolvedValue({ status: 'created' });
    actions.signInAction.mockResolvedValue({ status: 'failed' });
    render(<CreateAccountForm redirectTo="/order-history" signInHref="/sign-in" />);
    fill();
    await submit('Crear cuenta');
    expect((await screen.findByRole('alert')).textContent).toContain('Tu cuenta fue creada');
    expect(assign).not.toHaveBeenCalled();
  });

  it('marks each password requirement as the password meets it', () => {
    render(<CreateAccountForm redirectTo="/order-history" signInHref="/sign-in" />);
    expect(screen.getByText(/Al menos un número/).textContent).toContain('pendiente');
    type('Contraseña *', 'Abcdef1x');
    expect(screen.getByText(/Al menos un número/).textContent).toContain('cumplido');
  });
});

describe('ForgotPasswordForm', () => {
  it('validates the email, requests the reset with the token and shows the legacy confirmation', async () => {
    actions.requestPasswordResetAction.mockResolvedValue({ status: 'sent' });
    render(<ForgotPasswordForm signInHref="/sign-in" />);
    type('Correo electrónico', 'nope');
    await submit('Enviar');
    expect(actions.requestPasswordResetAction).not.toHaveBeenCalled();

    type('Correo electrónico', 'a@b.mx');
    await submit('Enviar');
    expect(actions.requestPasswordResetAction).toHaveBeenCalledWith({
      email: 'a@b.mx',
      recaptchaToken: 'rc-token',
    });
    expect((await screen.findByRole('status')).textContent).toContain(
      'Si hay una cuenta asociada con a@b.mx, recibirás un correo con un enlace para cambiar tu contraseña.',
    );
  });

  it('shows an error when the request fails', async () => {
    actions.requestPasswordResetAction.mockResolvedValue({ status: 'failed' });
    render(<ForgotPasswordForm signInHref="/sign-in" />);
    type('Correo electrónico', 'a@b.mx');
    await submit('Enviar');
    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos enviar');
  });
});
