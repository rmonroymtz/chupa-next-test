import { describe, expect, it } from 'vitest';
import {
  isAllowedSocialLoginUrl,
  isTrustedPopupMessage,
  parsePopupMessage,
  popupFeatures,
  popupUrl,
} from '@/modules/customer/domain/social-popup';

const URL = 'https://m.test/amsociallogin/social/login/?type=google';

describe('popupUrl', () => {
  it('asks Amasty for an ajax answer with a new token (legacy useSocButtons)', () => {
    expect(popupUrl(URL)).toBe(`${URL}&isAjax=true&generateToken=true`);
  });

  it('starts the query when the url has none', () => {
    expect(popupUrl('https://m.test/login')).toBe(
      'https://m.test/login?isAjax=true&generateToken=true',
    );
  });
});

describe('popupFeatures', () => {
  it('centers a 500x420 popup on the window like the legacy', () => {
    expect(popupFeatures({ screenX: 100, screenY: 50, outerWidth: 1300, outerHeight: 900 })).toBe(
      'width=500,height=420,left=500,top=242',
    );
  });
});

describe('parsePopupMessage', () => {
  it('reads a successful sign-in', () => {
    expect(parsePopupMessage({ result: 1, token: 'jwt.token', messages: [] })).toEqual({
      kind: 'signed_in',
      token: 'jwt.token',
    });
  });

  it('reads an Amasty error with its first message and the create-account redirect', () => {
    expect(
      parsePopupMessage({
        result: 0,
        messages: ['Ya existe una cuenta.'],
        redirect_data: { redirectWithError: 1 },
      }),
    ).toEqual({ kind: 'error', message: 'Ya existe una cuenta.', redirectToCreateAccount: true });
    expect(parsePopupMessage({ result: 0 })).toEqual({
      kind: 'error',
      message: null,
      redirectToCreateAccount: false,
    });
  });

  it('ignores anything else', () => {
    for (const data of [null, 'text', 42, {}, { result: 2 }]) {
      expect(parsePopupMessage(data)).toBeNull();
    }
  });

  it('reads a success without a token as a failed sign-in, so the shopper is told', () => {
    for (const data of [{ result: 1 }, { result: 1, token: '' }]) {
      expect(parsePopupMessage(data)).toEqual({
        kind: 'error',
        message: null,
        redirectToCreateAccount: false,
      });
    }
  });
});

describe('isTrustedPopupMessage', () => {
  const popup = {} as Window;

  it('trusts only the opened popup on the origin of the button url', () => {
    expect(isTrustedPopupMessage({ source: popup, origin: 'https://m.test' }, popup, URL)).toBe(
      true,
    );
  });

  it('rejects another window, another origin or no popup', () => {
    expect(
      isTrustedPopupMessage({ source: {} as Window, origin: 'https://m.test' }, popup, URL),
    ).toBe(false);
    expect(isTrustedPopupMessage({ source: popup, origin: 'https://evil.test' }, popup, URL)).toBe(
      false,
    );
    expect(isTrustedPopupMessage({ source: popup, origin: 'https://m.test' }, null, URL)).toBe(
      false,
    );
    expect(isTrustedPopupMessage({ source: null, origin: 'https://m.test' }, null, URL)).toBe(
      false,
    );
  });
});

describe('isAllowedSocialLoginUrl', () => {
  it('allows https, and http only on a local host', () => {
    expect(isAllowedSocialLoginUrl('https://m.test/login')).toBe(true);
    expect(isAllowedSocialLoginUrl('http://localhost:3000/login')).toBe(true);
    expect(isAllowedSocialLoginUrl('http://127.0.0.1:4010/login')).toBe(true);
    expect(isAllowedSocialLoginUrl('http://m.test/login')).toBe(false);
    expect(isAllowedSocialLoginUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedSocialLoginUrl('not a url')).toBe(false);
  });

  it('never trusts a popup on a plain http origin outside a local host', () => {
    const popup = {} as Window;
    expect(
      isTrustedPopupMessage({ source: popup, origin: 'http://m.test' }, popup, 'http://m.test/x'),
    ).toBe(false);
  });
});
