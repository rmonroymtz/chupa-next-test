import { describe, expect, it } from 'vitest';
import {
  authHref,
  passwordRequirements,
  resolveRedirect,
  validateEmail,
} from '@/modules/customer/domain/auth-forms';

describe('resolveRedirect', () => {
  it('uses the fallback when there is no from', () => {
    expect(resolveRedirect(undefined, '/my-account')).toBe('/my-account');
    expect(resolveRedirect('', '/my-account')).toBe('/my-account');
  });

  it('keeps a same-origin path with its query', () => {
    expect(resolveRedirect('/checkout?step=1', '/my-account')).toBe('/checkout?step=1');
  });

  it('rejects external, protocol-relative, backslash and non-path values', () => {
    for (const from of [
      'https://evil.test',
      '//evil.test',
      '/\\evil.test',
      'javascript:alert(1)',
      'checkout',
      '/a\nb',
    ]) {
      expect(resolveRedirect(from, '/my-account')).toBe('/my-account');
    }
  });

  it('never redirects back to an auth screen', () => {
    for (const from of ['/sign-in', '/create-account?x=1', '/forgot-password']) {
      expect(resolveRedirect(from, '/my-account')).toBe('/my-account');
    }
  });
});

describe('passwordRequirements', () => {
  it('reports each legacy requirement', () => {
    expect(passwordRequirements('abc')).toEqual({
      lowercase: true,
      uppercase: false,
      digit: false,
      minLength: false,
    });
    expect(passwordRequirements('Abcdef1x')).toEqual({
      lowercase: true,
      uppercase: true,
      digit: true,
      minLength: true,
    });
  });
});

describe('validateEmail', () => {
  it('accepts normal addresses and rejects malformed ones', () => {
    expect(validateEmail('usuario@ejemplo.com')).toBe(true);
    for (const value of ['', 'a', 'a@b', 'a b@c.mx', '@c.mx']) {
      expect(validateEmail(value)).toBe(false);
    }
  });
});

describe('authHref', () => {
  it('keeps a valid from and drops an invalid one', () => {
    expect(authHref('/create-account', '/checkout?step=1')).toBe(
      '/create-account?from=%2Fcheckout%3Fstep%3D1',
    );
    expect(authHref('/create-account', 'https://evil.test')).toBe('/create-account');
    expect(authHref('/create-account', undefined)).toBe('/create-account');
  });
});
