'use client';

import { useState, type FormEvent } from 'react';
import { requestPasswordResetAction } from '@/modules/customer/ui/customer-actions';
import { validateEmail } from '@/modules/customer/domain/auth-forms';
import { FormError } from '@/modules/customer/ui/form-error';
import { useRecaptcha } from '@/modules/customer/ui/use-recaptcha';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

// Shopper copy from the legacy PWA (`es_MX.json`, venia-ui `ForgotPassword`).
const REQUIRED = 'Este campo es obligatorio';
const INVALID_EMAIL =
  'Introduce una dirección de correo electrónico válida (ej., usuario@ejemplo.com).';
const FAILED = 'No pudimos enviar el correo. Inténtalo de nuevo.';

interface ForgotPasswordFormProps {
  readonly signInHref: string;
}

export function ForgotPasswordForm({ signInHref }: ForgotPasswordFormProps) {
  const getToken = useRecaptcha('CUSTOMER_FORGOT_PASSWORD');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const value = email.trim();
    const invalid = value === '' ? REQUIRED : validateEmail(value) ? undefined : INVALID_EMAIL;
    setError(invalid);
    setFormError(null);
    if (invalid) return;

    setSubmitting(true);
    try {
      const result = await requestPasswordResetAction({
        email: value,
        recaptchaToken: await getToken('forgotPassword'),
      });
      if (result.status === 'sent') setSentTo(value);
      else setFormError(FAILED);
    } catch {
      setFormError(FAILED);
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col gap-5">
        <p className="text-[15px]">
          Si hay una cuenta asociada con {sentTo}, recibirás un correo con un enlace para cambiar tu
          contraseña.
        </p>
        <a href={signInHref} className="text-sm text-ds-link underline">
          Iniciar sesión
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <p className="text-[15px]">
        Por favor ingresa la dirección de correo electrónico asociada con esta cuenta.
      </p>
      <FormError message={formError} />
      <Input
        label="Correo electrónico"
        type="email"
        name="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={error}
      />
      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" loading={submitting}>
          Enviar
        </Button>
        <a href={signInHref} className="text-sm text-ds-link underline">
          Cancelar
        </a>
      </div>
    </form>
  );
}
