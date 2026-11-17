import { describe, expect, it } from 'vitest';
import {
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
    for (const data of [null, 'text', 42, {}, { result: 1 }, { result: 1, token: '' }, { result: 2 }]) {
      expect(parsePopupMessage(data)).toBeNull();
    }
  });
});

describe('isTrustedPopupMessage', () => {
  const popup = {} as Window;

  it('trusts only the opened popup on the origin of the button url', () => {
    expect(isTrustedPopupMessage({ source: popup, origin: 'https://m.test' }, popup, URL)).toBe(true);
  });

  it('rejects another window, another origin or no popup', () => {
    expect(isTrustedPopupMessage({ source: {} as Window, origin: 'https://m.test' }, popup, URL)).toBe(
      false,
    );
    expect(isTrustedPopupMessage({ source: popup, origin: 'https://evil.test' }, popup, URL)).toBe(
      false,
    );
    expect(isTrustedPopupMessage({ source: popup, origin: 'https://m.test' }, null, URL)).toBe(false);
    expect(isTrustedPopupMessage({ source: null, origin: 'https://m.test' }, null, URL)).toBe(false);
  });
});
