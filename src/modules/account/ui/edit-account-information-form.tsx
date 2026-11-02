'use client';

import { useState, type FormEvent } from 'react';
import {
  planProfileUpdate,
  profileSaveError,
  sanitizePhone,
  EMAIL_NEEDS_PASSWORD,
  type ProfileFormErrors,
} from '@/modules/account/domain/profile-form';
import { useAccountProfile } from '@/modules/account/ui/account-profile';
import { redirectBrowser } from '@/modules/account/ui/browser-redirect';
import { browserCartStorage } from '@/modules/cart/ui/pwa-cart-storage';
import { authHref } from '@/modules/customer/domain/auth-forms';
import { updateProfileAction } from '@/modules/customer/ui/customer-actions';
import { FormError } from '@/modules/customer/ui/form-error';
import { useRecaptcha } from '@/modules/customer/ui/use-recaptcha';
import { Button } from '@/shared/ui/button';
import { FIELD_LABEL } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';

const VIEW_PATH = '/my-account/account-information';
const EDIT_PATH = '/my-account/edit-account-information';

/**
 * Legacy `EditAccountInformationPage`: name, email and phone, plus the
 * "Seguridad" section to change the password (or only confirm it, which
 * Magento needs to change the email). The steps run in the legacy order; a
 * save, even a partial one, returns to the profile with a full page load so
 * the shell reads the new data.
 */
export function EditAccountInformationForm() {
  const { profile, token } = useAccountProfile();
  const getToken = useRecaptcha('CUSTOMER_EDIT');
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function cancelPasswordChange(): void {
    setChangingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setShowPasswords(false);
    setErrors((current) => {
      const next = { ...current };
      delete next.currentPassword;
      delete next.newPassword;
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const { errors: next, changes } = planProfileUpdate(
      { firstName, lastName, email, phone, changingPassword, currentPassword, newPassword },
      profile,
    );
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;
    if (Object.keys(changes).length === 0) {
      redirectBrowser(VIEW_PATH);
      return;
    }

    setSubmitting(true);
    try {
      const result = await updateProfileAction({
        token,
        ...changes,
        recaptchaToken: changes.password ? await getToken('changePassword') : null,
      });
      if (result.status === 'saved') {
        redirectBrowser(VIEW_PATH);
        return;
      }
      if (result.status === 'not_authorized') {
        browserCartStorage.clearSigninToken();
        redirectBrowser(authHref('/sign-in', EDIT_PATH));
        return;
      }
      setFormError(profileSaveError(result.reason, result.partial));
    } catch {
      setFormError(profileSaveError('failed', false));
    } finally {
      setSubmitting(false);
    }
  }

  const passwordType = showPasswords ? 'text' : 'password';

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-6">
      <h1 className="text-sm font-bold tracking-wide text-ds-text-secondary">EDITAR DATOS</h1>
      <FormError message={formError} />
      <Input
        label="Nombre"
        name="firstname"
        autoComplete="given-name"
        aria-required="true"
        value={firstName}
        onChange={(event) => setFirstName(event.target.value)}
        error={errors.firstName}
      />
      <Input
        label="Apellido"
        name="lastname"
        autoComplete="family-name"
        aria-required="true"
        value={lastName}
        onChange={(event) => setLastName(event.target.value)}
        error={errors.lastName}
      />
      <Input
        label="Correo electrónico"
        type="email"
        name="email"
        autoComplete="email"
        aria-required="true"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        helperText={EMAIL_NEEDS_PASSWORD}
        error={errors.email}
      />
      <div className="flex flex-col gap-2">
        <label htmlFor="profile-phone" className={FIELD_LABEL}>
          Teléfono
        </label>
        <div className="flex items-start gap-2">
          <span className="grid h-12 shrink-0 place-items-center rounded-md border border-ds-border px-3 text-sm text-ds-text">
            🇲🇽 +52
          </span>
          <Input
            id="profile-phone"
            name="phone_number"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10 dígitos"
            maxLength={10}
            value={phone}
            onChange={(event) => setPhone(sanitizePhone(event.target.value))}
            className="flex-1"
          />
        </div>
      </div>

      <section aria-labelledby="profile-security" className="flex flex-col gap-4">
        <h2 id="profile-security" className="text-lg font-semibold text-ds-text">
          Seguridad
        </h2>
        {changingPassword ? (
          <>
            <Input
              label="Contraseña actual"
              type={passwordType}
              name="password"
              autoComplete="current-password"
              aria-required="true"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              error={errors.currentPassword}
            />
            <Input
              label="Nueva contraseña"
              type={passwordType}
              name="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              error={errors.newPassword}
            />
            <div className="flex flex-wrap gap-4 text-sm">
              <button
                type="button"
                onClick={() => setShowPasswords((shown) => !shown)}
                className="rounded-xs font-semibold text-ds-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus"
              >
                {showPasswords ? 'Ocultar contraseña' : 'Ver contraseña'}
              </button>
              <button
                type="button"
                onClick={cancelPasswordChange}
                className="rounded-xs text-ds-text-secondary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus"
              >
                Cancelar cambio de contraseña
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-ds-text-secondary">Contraseña</span>
              <span className="tracking-widest text-ds-text">••••••••</span>
            </div>
            <Button type="button" variant="secondary" onClick={() => setChangingPassword(true)}>
              Cambiar contraseña
            </Button>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={submitting}>
          {submitting ? 'Guardando...' : 'Guardar cambios'}
        </Button>
        <Button href={VIEW_PATH} variant="tertiary" nativeAnchor>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
