import type { RecaptchaConfig } from '@/modules/customer/application/ports';

export type RecaptchaForm = 'CUSTOMER_LOGIN' | 'CUSTOMER_CREATE' | 'CUSTOMER_FORGOT_PASSWORD';

const SCRIPT_URL = 'https://www.google.com/recaptcha/api.js';

/** Like peregrine `useGoogleReCaptcha`: a token is needed only for a form Magento lists. */
export function isRecaptchaEnabled(config: RecaptchaConfig | null, form: RecaptchaForm): boolean {
  return config !== null && config.siteKey !== '' && config.forms.includes(form);
}

/**
 * Script url of the v3 API. Peregrine renders an explicit widget for the
 * `inline` badge; this storefront always renders by key (the invisible v3
 * flow), which works for every badge position.
 */
export function recaptchaScriptUrl(config: RecaptchaConfig, onloadCallback: string): string {
  const url = new URL(SCRIPT_URL);
  url.searchParams.set('badge', config.badgePosition);
  url.searchParams.set('render', config.siteKey);
  url.searchParams.set('onload', onloadCallback);
  if (config.languageCode) url.searchParams.set('hl', config.languageCode);
  return url.toString();
}
