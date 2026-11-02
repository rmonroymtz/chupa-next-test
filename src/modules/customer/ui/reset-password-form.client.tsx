'use client';

import { useState, type FormEvent } from 'react';
import { FormError } from '@/modules/customer/ui/form-error';
import { resetPasswordAction } from '@/modules/customer/ui/customer-actions';
import { useRecaptcha } from '@/modules/customer/ui/use-recaptcha';
import { Button } from '@/shared/ui/button';
import { Icon } from '@/shared/ui/icon';
import { Input } from '@/shared/ui/input';

// Shopper copy from the legacy PWA (`es_MX.json`, venia-ui `ResetPassword`) except where noted.
const REQUIRED = 'Este campo es obligatorio';
const MISSING_TOKEN = 'Uh oh, algo salió mal. Verifica el enlace o inténtalo de nuevo.';
const SAVED =
  'Tu nueva contraseña ha sido guardada. Por favor usa esta contraseña para iniciar sesión en tu Cuenta.';
// Not in the legacy (it printed Magento's English text): written for the cases the gateway tells apart.
const INVALID_TOKEN =
  'El enlace para restablecer la contraseña no es válido o ya venció. Solicita uno nuevo.';
const WEAK_PASSWORD =
  'La contraseña debe contener: minúsculas, MAYÚSCULAS, números (0-9) y símbolos (!@#$).';
const FAILED = 'No pudimos guardar tu contraseña. Inténtalo de nuevo.';

/** Auth screens are plain anchors: the edge may serve each of them from either origin. */
const FORGOT_PASSWORD_HREF = '/forgot-password';
const SIGN_IN_HREF = '/sign-in';

const LINK =
  'rounded-xs font-semibold text-ds-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus';

interface ResetPasswordFormProps {
  /** The `token` of the emailed link; null when the url has none. */
  readonly token: string | null;
}

/**
 * Legacy `ResetPassword` (`/customer/account/createPassword?token=`): email and
 * new password, saved with the link token. The new password has no client
 * check beyond "required" (Magento decides, as in the legacy). On success the
 * form is replaced by the confirmation; there is no redirect.
 */
export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const getToken = useRecaptcha('CUSTOMER_FORGOT_PASSWORD');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <FormError message={MISSING_TOKEN} />
        <a href={FORGOT_PASSWORD_HREF} className={LINK}>
          Solicitar un enlace nuevo
        </a>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-ds-text">{SAVED}</p>
        <a href={SIGN_IN_HREF} className={LINK}>
          Iniciar sesión
        </a>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting || !token) return;
    const next = {
      ...(email.trim() === '' ? { email: REQUIRED } : {}),
      ...(password === '' ? { password: REQUIRED } : {}),
    };
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const result = await resetPasswordAction({
        email: email.trim(),
        token,
        newPassword: password,
        recaptchaToken: await getToken('resetPassword'),
      });
      if (result.status === 'reset') {
        setSaved(true);
        return;
      }
      setFormError(
        result.status === 'invalid_token'
          ? INVALID_TOKEN
          : result.status === 'weak_password'
            ? WEAK_PASSWORD
            : FAILED,
      );
    } catch {
      setFormError(FAILED);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <p className="text-sm text-ds-text-secondary">
        Por favor ingresa tu dirección de correo electrónico y una nueva contraseña.
      </p>
      <FormError message={formError} />
      <Input
        label="Correo electrónico"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="tu@correo.com"
        leadingIcon="mail"
        aria-required="true"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={errors.email}
      />
      <Input
        label="Nueva contraseña"
        type={showPassword ? 'text' : 'password'}
        name="password"
        autoComplete="new-password"
        leadingIcon="lock"
        aria-required="true"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.password}
        trailing={
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={showPassword}
            className="flex size-8 items-center justify-center rounded-xs text-ds-text-secondary hover:text-ds-text focus-visible:outline-2 focus-visible:outline-ds-focus"
          >
            <Icon name="eye" size={18} />
          </button>
        }
      />
      <Button type="submit" size="lg" loading={submitting} className="w-full">
        {submitting ? 'Guardando' : 'Guardar contraseña'}
      </Button>
    </form>
  );
}
