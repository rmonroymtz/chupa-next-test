import { describe, expect, it } from 'vitest';
import type { CustomerProfile } from '@/modules/customer/application/ports';
import {
  EMAIL_NEEDS_PASSWORD,
  PASSWORD_CLASSES,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MUST_DIFFER,
  phoneDisplay,
  planProfileUpdate,
  profileFullName,
  REQUIRED,
  sanitizePhone,
  type ProfileFormValues,
} from '@/modules/account/domain/profile-form';

const ORIGINAL: CustomerProfile = {
  firstName: 'Ana',
  middleName: 'María',
  lastName: 'Pérez',
  email: 'ana@example.mx',
  phone: '6643119682',
  photoUrl: null,
};

const UNCHANGED: ProfileFormValues = {
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@example.mx',
  phone: '6643119682',
  changingPassword: false,
  currentPassword: '',
  newPassword: '',
};

const plan = (overrides: Partial<ProfileFormValues>) =>
  planProfileUpdate({ ...UNCHANGED, ...overrides }, ORIGINAL);

describe('view helpers', () => {
  it('joins first, middle and last name, skipping blanks', () => {
    expect(profileFullName(ORIGINAL)).toBe('Ana María Pérez');
    expect(profileFullName({ ...ORIGINAL, middleName: '' })).toBe('Ana Pérez');
  });

  it('shows the phone with the Mexican prefix only when there is one', () => {
    expect(phoneDisplay('6643119682')).toBe('+52 6643119682');
    expect(phoneDisplay(null)).toBeNull();
    expect(phoneDisplay('')).toBeNull();
  });

  it('keeps only digits and at most ten', () => {
    expect(sanitizePhone('(664) 311-9682 ext 12')).toBe('6643119682');
    expect(sanitizePhone('abc')).toBe('');
  });
});

describe('planProfileUpdate', () => {
  it('has nothing to do without changes', () => {
    expect(plan({})).toEqual({ errors: {}, changes: {} });
  });

  it('requires first name, last name and email', () => {
    expect(plan({ firstName: ' ', lastName: '', email: '  ' }).errors).toEqual({
      firstName: REQUIRED,
      lastName: REQUIRED,
      email: REQUIRED,
    });
  });

  it('plans a phone change with the digits only, and a cleared phone', () => {
    expect(plan({ phone: '55 1234 5678' }).changes).toEqual({ phone: '5512345678' });
    expect(plan({ phone: '' }).changes).toEqual({ phone: '' });
  });

  it('plans a name change as an identity step without a password', () => {
    expect(plan({ firstName: ' Anita ' }).changes).toEqual({
      identity: { firstName: 'Anita', lastName: 'Pérez', email: 'ana@example.mx', password: '' },
    });
  });

  it('asks to confirm the password in the Seguridad section before changing the email', () => {
    expect(plan({ email: 'nueva@example.mx' }).errors.email).toBe(EMAIL_NEEDS_PASSWORD);
    expect(EMAIL_NEEDS_PASSWORD).toBe(
      'Para cambiar tu correo deberás confirmar tu contraseña en la sección Seguridad.',
    );
  });

  it('needs the current password to change the email, and sends it with the identity', () => {
    const open = { email: 'nueva@example.mx', changingPassword: true };
    expect(plan(open).errors.currentPassword).toBe(REQUIRED);
    expect(plan({ ...open, currentPassword: 'Current1!' })).toEqual({
      errors: {},
      changes: {
        identity: {
          firstName: 'Ana',
          lastName: 'Pérez',
          email: 'nueva@example.mx',
          password: 'Current1!',
        },
      },
    });
  });

  it('plans a password change with the current and the new password', () => {
    expect(
      plan({ changingPassword: true, currentPassword: 'Current1!', newPassword: 'Brand-new2!' }),
    ).toEqual({
      errors: {},
      changes: { password: { current: 'Current1!', next: 'Brand-new2!' } },
    });
  });

  it('validates the new password: current required, 8 characters, 3 classes, different', () => {
    const base = { changingPassword: true };
    expect(plan({ ...base, newPassword: 'Brand-new2!' }).errors.currentPassword).toBe(REQUIRED);
    expect(plan({ ...base, currentPassword: 'x', newPassword: 'Ab1!' }).errors.newPassword).toBe(
      PASSWORD_MIN_LENGTH,
    );
    expect(
      plan({ ...base, currentPassword: 'x', newPassword: 'abcdefgh' }).errors.newPassword,
    ).toBe(PASSWORD_CLASSES);
    expect(
      plan({ ...base, currentPassword: 'Same-pass1', newPassword: 'Same-pass1' }).errors
        .newPassword,
    ).toBe(PASSWORD_MUST_DIFFER);
    expect(PASSWORD_MIN_LENGTH).toBe('Debe contener al menos 8 caracter(es).');
    expect(PASSWORD_CLASSES).toBe(
      'Una contraseña debe contener al menos 3 de los siguientes: minúsculas, mayúsculas, dígitos, caracteres especiales.',
    );
  });

  it('accepts three of the four classes', () => {
    expect(
      plan({ changingPassword: true, currentPassword: 'x', newPassword: 'abcdEFG123' }).errors,
    ).toEqual({});
    expect(
      plan({ changingPassword: true, currentPassword: 'x', newPassword: 'abcdefg1!' }).errors,
    ).toEqual({});
  });

  it('does nothing with the password fields when the section is open but the new password is empty', () => {
    expect(plan({ changingPassword: true, currentPassword: 'Current1!' })).toEqual({
      errors: {},
      changes: {},
    });
  });

  it('ignores the password fields while the section is closed', () => {
    expect(plan({ currentPassword: 'a', newPassword: 'b' })).toEqual({ errors: {}, changes: {} });
  });

  it('plans the three steps together', () => {
    const result = plan({
      phone: '5512345678',
      email: 'nueva@example.mx',
      changingPassword: true,
      currentPassword: 'Current1!',
      newPassword: 'Brand-new2!',
    });
    expect(Object.keys(result.changes)).toEqual(['phone', 'identity', 'password']);
    expect(result.errors).toEqual({});
  });
});
