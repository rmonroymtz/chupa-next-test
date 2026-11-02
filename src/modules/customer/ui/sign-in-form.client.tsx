'use client';

import { useState, type FormEvent } from 'react';
import { browserCartStorage } from '@/modules/cart/ui/pwa-cart-storage';
import { signInAction } from '@/modules/customer/ui/customer-actions';
import { FormError } from '@/modules/customer/ui/form-error';
import { startSession } from '@/modules/customer/ui/start-session';
import { useRecaptcha } from '@/modules/customer/ui/use-recaptcha';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

// Shopper copy from the legacy PWA (`es_MX.json`, venia-ui `SignIn`).
const REQUIRED = 'Este campo es obligatorio';
const INVALID_CREDENTIALS =
  'El inicio de sesión de la cuenta fue incorrecto o su cuenta está temporalmente deshabilitada. Espere e inténtelo de nuevo más tarde.';
const FAILED = 'No pudimos iniciar sesión. Inténtalo de nuevo.';
const STORAGE_FAILED =
  'No pudimos guardar tu sesión. Revisa que tu navegador permita almacenamiento.';

interface SignInFormProps {
  /** Where to go once signed in (already checked to be a path on this site). */
  readonly redirectTo: string;
  readonly createAccountHref: string;
  readonly forgotPasswordHref: string;
}

export function SignInForm({ redirectTo, createAccountHref, forgotPasswordHref }: SignInFormProps) {
  const getToken = useRecaptcha('CUSTOMER_LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const next = {
      ...(email.trim() === '' ? { email: REQUIRED } : {}),
      ...(password === '' ? { password: REQUIRED } : {}),
    };
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const result = await signInAction({
        email: email.trim(),
        password,
        guestCartId: browserCartStorage.readCartId(),
        recaptchaToken: await getToken('signIn'),
      });
      if (result.status === 'signed_in') {
        if (!startSession(result)) {
          setFormError(STORAGE_FAILED);
          return;
        }
        window.location.assign(redirectTo);
        return;
      }
      setFormError(result.status === 'invalid_credentials' ? INVALID_CREDENTIALS : FAILED);
    } catch {
      setFormError(FAILED);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <p className="text-[13px] text-ds-text-secondary">*Este campo es obligatorio</p>
      <FormError message={formError} />
      <Input
        label="Correo electrónico *"
        type="email"
        name="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={errors.email}
        aria-label="Correo electrónico requerido"
      />
      <div className="flex flex-col gap-2">
        <Input
          label="Contraseña *"
          type={showPassword ? 'text' : 'password'}
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          aria-label="Contraseña requerida"
        />
        <button
          type="button"
          onClick={() => setShowPassword((shown) => !shown)}
          aria-pressed={showPassword}
          className="self-start text-sm text-ds-link underline"
        >
          {showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        </button>
      </div>
      <a href={forgotPasswordHref} className="self-start text-sm text-ds-link underline">
        Olvidé mi contraseña
      </a>
      <Button type="submit" size="lg" loading={submitting}>
        {submitting ? 'Iniciando sesión' : 'Iniciar sesión'}
      </Button>
      <p className="flex items-center gap-2 text-sm">
        <strong>¿No tienes cuenta?</strong>
        <a href={createAccountHref} className="text-ds-link underline">
          Crear cuenta
        </a>
      </p>
    </form>
  );
}
