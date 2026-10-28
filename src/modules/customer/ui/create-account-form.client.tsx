'use client';

import { useState, type FormEvent } from 'react';
import { browserCartStorage } from '@/modules/cart/ui/pwa-cart-storage';
import { passwordRequirements, validateEmail } from '@/modules/customer/domain/auth-forms';
import { createAccountAction, signInAction } from '@/modules/customer/ui/customer-actions';
import { FormError } from '@/modules/customer/ui/form-error';
import { startSession } from '@/modules/customer/ui/start-session';
import { useRecaptcha } from '@/modules/customer/ui/use-recaptcha';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';

// Shopper copy from the legacy PWA (`es_MX.json`, venia-ui `CreateAccount`, `useCreateAccount`).
const REQUIRED = 'Este campo es obligatorio';
const INVALID_EMAIL =
  'Introduce una dirección de correo electrónico válida (ej., usuario@ejemplo.com).';
const EMAIL_TAKEN =
  'Esta dirección de correo ya está registrada. Por favor, utilice otra dirección o inicie sesión con su cuenta existente.';
const WEAK_PASSWORD =
  'La contraseña debe contener: minúsculas, MAYÚSCULAS, números (0-9) y símbolos (!@#$).';
const FAILED = 'No pudimos crear tu cuenta. Inténtalo de nuevo.';
const CREATED_NOT_SIGNED_IN =
  'Tu cuenta fue creada, pero no pudimos iniciar tu sesión. Inicia sesión con tus datos.';
const STORAGE_FAILED =
  'No pudimos guardar tu sesión. Revisa que tu navegador permita almacenamiento.';
const MAX_LENGTH = 150;
const MIN_PASSWORD = 8;

interface CreateAccountFormProps {
  readonly redirectTo: string;
  readonly signInHref: string;
}

type FieldErrors = Partial<Record<'firstName' | 'lastName' | 'email' | 'password', string>>;

function validate(values: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  for (const key of ['firstName', 'lastName'] as const) {
    const value = values[key].trim();
    if (value === '') errors[key] = REQUIRED;
    else if (value.length > MAX_LENGTH)
      errors[key] = `Debe contener máximo ${MAX_LENGTH} caracteres.`;
  }
  const email = values.email.trim();
  if (email === '') errors.email = REQUIRED;
  else if (!validateEmail(email) || email.length > MAX_LENGTH) errors.email = INVALID_EMAIL;
  if (values.password === '') errors.password = REQUIRED;
  else if (values.password.length < MIN_PASSWORD) {
    errors.password = `Debe contener al menos ${MIN_PASSWORD} caracter(es).`;
  }
  return errors;
}

export function CreateAccountForm({ redirectTo, signInHref }: CreateAccountFormProps) {
  const getCreateToken = useRecaptcha('CUSTOMER_CREATE');
  const getSignInToken = useRecaptcha('CUSTOMER_LOGIN');
  const [values, setValues] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));
  const requirements = passwordRequirements(values.password);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const next = validate(values);
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const email = values.email.trim();
      const created = await createAccountAction({
        email,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        password: values.password,
        isSubscribed,
        recaptchaToken: await getCreateToken('createAccount'),
      });
      if (created.status !== 'created') {
        setFormError(
          created.status === 'email_taken'
            ? EMAIL_TAKEN
            : created.status === 'weak_password'
              ? WEAK_PASSWORD
              : FAILED,
        );
        return;
      }
      // Each Magento call needs its own reCAPTCHA token, so sign-in is a second action.
      const session = await signInAction({
        email,
        password: values.password,
        guestCartId: browserCartStorage.readCartId(),
        recaptchaToken: await getSignInToken('signIn'),
      });
      if (session.status !== 'signed_in') {
        setFormError(CREATED_NOT_SIGNED_IN);
        return;
      }
      if (!startSession(session)) {
        setFormError(STORAGE_FAILED);
        return;
      }
      window.location.assign(redirectTo);
    } catch {
      setFormError(FAILED);
    } finally {
      setSubmitting(false);
    }
  }

  const items: [keyof typeof requirements, string][] = [
    ['lowercase', 'Al menos una letra minúscula'],
    ['uppercase', 'Al menos una letra mayúscula'],
    ['digit', 'Al menos un número'],
    ['minLength', 'Al menos 8 caracteres'],
  ];

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <p className="text-[13px] text-ds-text-secondary">*Este campo es obligatorio</p>
      <FormError message={formError} />
      <Input
        label="Nombre *"
        name="firstName"
        autoComplete="given-name"
        value={values.firstName}
        onChange={set('firstName')}
        error={errors.firstName}
      />
      <Input
        label="Apellido *"
        name="lastName"
        autoComplete="family-name"
        value={values.lastName}
        onChange={set('lastName')}
        error={errors.lastName}
      />
      <Input
        label="Correo electrónico *"
        type="email"
        name="email"
        autoComplete="email"
        value={values.email}
        onChange={set('email')}
        error={errors.email}
      />
      <div className="flex flex-col gap-2">
        <Input
          label="Contraseña *"
          type={showPassword ? 'text' : 'password'}
          name="password"
          autoComplete="new-password"
          value={values.password}
          onChange={set('password')}
          error={errors.password}
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
      <div className="text-sm">
        <p>La contraseña deberá cumplir con los siguientes requerimientos:</p>
        <ul className="mt-2 flex flex-col gap-1">
          {items.map(([key, label]) => (
            <li
              key={key}
              className={requirements[key] ? 'text-ds-success' : 'text-ds-text-secondary'}
            >
              <span aria-hidden="true">{requirements[key] ? '✓' : '✗'}</span> {label}
              <span className="sr-only">{requirements[key] ? ' (cumplido)' : ' (pendiente)'}</span>
            </li>
          ))}
        </ul>
      </div>
      <Checkbox
        label="Suscribirse a noticias y actualizaciones"
        name="subscribe"
        checked={isSubscribed}
        onChange={(event) => setIsSubscribed(event.target.checked)}
      />
      <Button type="submit" size="lg" loading={submitting}>
        Crear cuenta
      </Button>
      <p className="flex items-center gap-2 text-sm">
        <strong>¿Ya tienes cuenta?</strong>
        <a href={signInHref} className="text-ds-link underline">
          Iniciar sesión
        </a>
      </p>
    </form>
  );
}
