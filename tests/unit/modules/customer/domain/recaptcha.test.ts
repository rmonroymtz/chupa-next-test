import { describe, expect, it } from 'vitest';
import { isRecaptchaEnabled, recaptchaScriptUrl } from '@/modules/customer/domain/recaptcha';

const CONFIG = {
  siteKey: 'site-key',
  badgePosition: 'bottomright',
  languageCode: 'es',
  forms: ['CUSTOMER_LOGIN', 'CUSTOMER_CREATE'],
};

describe('isRecaptchaEnabled', () => {
  it('is on only for a listed form with a site key', () => {
    expect(isRecaptchaEnabled(CONFIG, 'CUSTOMER_LOGIN')).toBe(true);
    expect(isRecaptchaEnabled(CONFIG, 'CUSTOMER_FORGOT_PASSWORD')).toBe(false);
    expect(isRecaptchaEnabled(null, 'CUSTOMER_LOGIN')).toBe(false);
    expect(isRecaptchaEnabled({ ...CONFIG, siteKey: '' }, 'CUSTOMER_LOGIN')).toBe(false);
  });
});

describe('recaptchaScriptUrl', () => {
  it('loads api.js like the PWA hook: render key, badge, onload and language', () => {
    const url = new URL(recaptchaScriptUrl(CONFIG, 'onloadCb'));
    expect(url.origin + url.pathname).toBe('https://www.google.com/recaptcha/api.js');
    expect(url.searchParams.get('render')).toBe('site-key');
    expect(url.searchParams.get('badge')).toBe('bottomright');
    expect(url.searchParams.get('onload')).toBe('onloadCb');
    expect(url.searchParams.get('hl')).toBe('es');
  });

  it('omits hl without a language and renders by key even for the inline badge', () => {
    const url = new URL(
      recaptchaScriptUrl({ ...CONFIG, languageCode: null, badgePosition: 'inline' }, 'cb'),
    );
    expect(url.searchParams.has('hl')).toBe(false);
    expect(url.searchParams.get('render')).toBe('site-key');
  });
});
