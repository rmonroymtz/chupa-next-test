// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPasswordForm } from '@/modules/customer/ui/reset-password-form.client';

const actions = vi.hoisted(() => ({ resetPasswordAction: vi.fn() }));
vi.mock('@/modules/customer/ui/customer-actions', () => actions);

const recaptcha = vi.hoisted(() => ({ form: '', action: '' }));
vi.mock('@/modules/customer/ui/use-recaptcha', () => ({
  useRecaptcha: (form: string) => {
    recaptcha.form = form;
    return async (action: string) => {
      recaptcha.action = action;
      return 'rc-token';
    };
  },
}));

const field = (name: string) => screen.getByLabelText(name, { exact: true }) as HTMLInputElement;
const type = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

beforeEach(() => {
  actions.resetPasswordAction.mockReset();
});
afterEach(cleanup);

describe('ResetPasswordForm', () => {
  it('shows the legacy explanation and the two fields', () => {
    render(<ResetPasswordForm token="a1b2c3d4" />);
    expect(
      screen.getByText(
        'Por favor ingresa tu dirección de correo electrónico y una nueva contraseña.',
      ),
    ).toBeTruthy();
    expect(field('Correo electrónico').type).toBe('email');
    expect(field('Nueva contraseña').type).toBe('password');
  });

  it('shows the legacy error and a way to ask for a new link when the url has no token', () => {
    render(<ResetPasswordForm token={null} />);
    expect(screen.getByRole('alert').textContent).toBe(
      'Uh oh, algo salió mal. Verifica el enlace o inténtalo de nuevo.',
    );
    expect(
      screen.getByRole('link', { name: 'Solicitar un enlace nuevo' }).getAttribute('href'),
    ).toBe('/forgot-password');
    expect(screen.queryByRole('button', { name: 'Guardar contraseña' })).toBeNull();
  });

  it('requires both fields and sends nothing while one is empty', async () => {
    render(<ResetPasswordForm token="a1b2c3d4" />);
    save();
    expect((await screen.findAllByText('Este campo es obligatorio')).length).toBe(2);
    expect(actions.resetPasswordAction).not.toHaveBeenCalled();
  });

  it('toggles the password visibility', () => {
    render(<ResetPasswordForm token="a1b2c3d4" />);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(field('Nueva contraseña').type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(field('Nueva contraseña').type).toBe('password');
  });

  it('sends the email, the link token, the new password and the reCAPTCHA token', async () => {
    actions.resetPasswordAction.mockResolvedValue({ status: 'reset' });
    render(<ResetPasswordForm token="a1b2c3d4" />);
    type('Correo electrónico', ' ana@example.mx ');
    type('Nueva contraseña', 'Brand-new2!');
    save();

    await waitFor(() =>
      expect(actions.resetPasswordAction).toHaveBeenCalledWith({
        email: 'ana@example.mx',
        token: 'a1b2c3d4',
        newPassword: 'Brand-new2!',
        recaptchaToken: 'rc-token',
      }),
    );
    expect(recaptcha.form).toBe('CUSTOMER_FORGOT_PASSWORD');
    expect(recaptcha.action).toBe('resetPassword');
  });

  it('replaces the form with the confirmation and a sign-in link after saving', async () => {
    actions.resetPasswordAction.mockResolvedValue({ status: 'reset' });
    render(<ResetPasswordForm token="a1b2c3d4" />);
    type('Correo electrónico', 'ana@example.mx');
    type('Nueva contraseña', 'Brand-new2!');
    save();

    expect(
      await screen.findByText(
        'Tu nueva contraseña ha sido guardada. Por favor usa esta contraseña para iniciar sesión en tu Cuenta.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Guardar contraseña' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' }).getAttribute('href')).toBe(
      '/sign-in',
    );
  });

  it.each([
    [
      'invalid_token',
      'El enlace para restablecer la contraseña no es válido o ya venció. Solicita uno nuevo.',
    ],
    [
      'weak_password',
      'La contraseña debe contener: minúsculas, MAYÚSCULAS, números (0-9) y símbolos (!@#$).',
    ],
    ['failed', 'No pudimos guardar tu contraseña. Inténtalo de nuevo.'],
  ])('shows the %s error and keeps the form', async (status, message) => {
    actions.resetPasswordAction.mockResolvedValue({ status });
    render(<ResetPasswordForm token="a1b2c3d4" />);
    type('Correo electrónico', 'ana@example.mx');
    type('Nueva contraseña', 'x');
    save();

    expect((await screen.findByRole('alert')).textContent).toBe(message);
    expect(field('Nueva contraseña').value).toBe('x');
  });

  it('shows the generic error when the request throws', async () => {
    actions.resetPasswordAction.mockRejectedValue(new Error('network'));
    render(<ResetPasswordForm token="a1b2c3d4" />);
    type('Correo electrónico', 'ana@example.mx');
    type('Nueva contraseña', 'x');
    save();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'No pudimos guardar tu contraseña. Inténtalo de nuevo.',
    );
  });
});
