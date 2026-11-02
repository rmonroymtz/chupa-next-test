import type { CustomerProfile } from '@/modules/customer/application/ports';

/**
 * Rules of the profile pages, from the legacy PWA (`AccountInformationPage`,
 * `EditAccountInformationPage`, peregrine `useAccountInformationPage`). Copy is
 * the legacy Spanish (`es_MX.json`) except where noted.
 */

export const REQUIRED = 'Este campo es obligatorio';
export const PASSWORD_MIN_LENGTH = 'Debe contener al menos 8 caracter(es).';
export const PASSWORD_CLASSES =
  'Una contraseña debe contener al menos 3 de los siguientes: minúsculas, mayúsculas, dígitos, caracteres especiales.';
/** The legacy message is "{value} debe ser diferente" with the raw field key; this one reads as a sentence. */
export const PASSWORD_MUST_DIFFER = 'La nueva contraseña debe ser diferente de la actual.';
/** The legacy hint under the email field; here it is also the error when the section is closed. */
export const EMAIL_NEEDS_PASSWORD =
  'Para cambiar tu correo deberás confirmar tu contraseña en la sección Seguridad.';

const MIN_PASSWORD_LENGTH = 8;
const MIN_PASSWORD_CLASSES = 3;

/** Full name as the legacy view shows it: first, middle and last, blanks skipped. */
export function profileFullName(profile: CustomerProfile): string {
  return [profile.firstName, profile.middleName, profile.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
}

/** "+52 {n}" only when there is a phone (legacy `CustomerDetails`). */
export function phoneDisplay(phone: string | null): string | null {
  return phone ? `+52 ${phone}` : null;
}

/** The legacy phone field is numeric with `maxLength` 10. */
export function sanitizePhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 10);
}

function passwordClasses(password: string): number {
  return [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((rule) => rule.test(password)).length;
}

export interface ProfileFormValues {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  /** The "Cambiar contraseña" section is open. */
  readonly changingPassword: boolean;
  readonly currentPassword: string;
  readonly newPassword: string;
}

export interface ProfileFormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

/** The steps the legacy `handleSubmit` runs, only the ones that changed. */
export interface ProfileChanges {
  phone?: string;
  identity?: { firstName: string; lastName: string; email: string; password: string };
  password?: { current: string; next: string };
}

/**
 * Validates the form and plans the Magento steps. The new password is
 * optional here (the legacy form forced one whenever the section was open, so
 * confirming the password to change the email also meant changing it).
 */
export function planProfileUpdate(
  values: ProfileFormValues,
  original: CustomerProfile,
): { errors: ProfileFormErrors; changes: ProfileChanges } {
  const errors: ProfileFormErrors = {};
  const firstName = values.firstName.trim();
  const lastName = values.lastName.trim();
  const email = values.email.trim();
  if (!firstName) errors.firstName = REQUIRED;
  if (!lastName) errors.lastName = REQUIRED;
  if (!email) errors.email = REQUIRED;

  const emailChanged = email !== '' && email !== original.email;
  const open = values.changingPassword;
  if (emailChanged && !open) errors.email = EMAIL_NEEDS_PASSWORD;

  const wantsNewPassword = open && values.newPassword !== '';
  if (open && (emailChanged || wantsNewPassword) && values.currentPassword === '') {
    errors.currentPassword = REQUIRED;
  }
  if (wantsNewPassword) {
    if (values.newPassword.length < MIN_PASSWORD_LENGTH) errors.newPassword = PASSWORD_MIN_LENGTH;
    else if (passwordClasses(values.newPassword) < MIN_PASSWORD_CLASSES) {
      errors.newPassword = PASSWORD_CLASSES;
    } else if (values.newPassword === values.currentPassword) {
      errors.newPassword = PASSWORD_MUST_DIFFER;
    }
  }

  const changes: ProfileChanges = {};
  const phone = sanitizePhone(values.phone);
  if (phone !== (original.phone ?? '')) changes.phone = phone;
  const identityChanged =
    firstName !== original.firstName.trim() ||
    lastName !== original.lastName.trim() ||
    emailChanged;
  if (identityChanged) {
    changes.identity = {
      firstName,
      lastName,
      email,
      password: open ? values.currentPassword : '',
    };
  }
  if (wantsNewPassword) {
    changes.password = { current: values.currentPassword, next: values.newPassword };
  }
  return { errors, changes };
}

const WEAK_PASSWORD =
  'La contraseña debe contener: minúsculas, MAYÚSCULAS, números (0-9) y símbolos (!@#$).';
const EMAIL_TAKEN =
  'Esta dirección de correo ya está registrada. Por favor, utilice otra dirección.';
const WRONG_PASSWORD = 'La contraseña actual no es correcta.';
const FAILED = 'No pudimos guardar tus cambios. Inténtalo de nuevo.';
const PARTIAL =
  'Guardamos una parte de tus cambios, pero no pudimos guardar el resto. Revisa tus datos e inténtalo de nuevo.';

/**
 * Form-level message of a failed save. The legacy printed Magento's own text;
 * these are written for the cases the gateway tells apart. A partial save wins:
 * the shopper has to know part of the data already changed.
 */
export function profileSaveError(
  reason: 'email_taken' | 'wrong_password' | 'weak_password' | 'failed',
  partial: boolean,
): string {
  if (partial) return PARTIAL;
  if (reason === 'email_taken') return EMAIL_TAKEN;
  if (reason === 'wrong_password') return WRONG_PASSWORD;
  if (reason === 'weak_password') return WEAK_PASSWORD;
  return FAILED;
}
