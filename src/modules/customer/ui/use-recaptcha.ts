'use client';

import { useCallback, useEffect } from 'react';
import type { RecaptchaConfig } from '@/modules/customer/application/ports';
import {
  isRecaptchaEnabled,
  recaptchaScriptUrl,
  type RecaptchaForm,
} from '@/modules/customer/domain/recaptcha';
import { getRecaptchaConfigAction } from '@/modules/customer/ui/customer-actions';

interface Grecaptcha {
  execute(siteKey: string, options: { action: string }): Promise<string>;
}

const ONLOAD_CALLBACK = 'onloadRecaptchaCallback';

// One config read and one script load per page, shared by every form.
let configPromise: Promise<RecaptchaConfig | null> | undefined;
let scriptPromise: Promise<void> | undefined;

function loadConfig(): Promise<RecaptchaConfig | null> {
  configPromise ??= getRecaptchaConfigAction().catch(() => null);
  return configPromise;
}

function grecaptcha(): Grecaptcha | undefined {
  return (globalThis as { grecaptcha?: Grecaptcha }).grecaptcha;
}

function loadScript(config: RecaptchaConfig): Promise<void> {
  if (grecaptcha()) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    (globalThis as Record<string, unknown>)[ONLOAD_CALLBACK] = () => resolve();
    const script = document.createElement('script');
    script.src = recaptchaScriptUrl(config, ONLOAD_CALLBACK);
    script.async = true;
    script.onerror = () => {
      scriptPromise = undefined;
      reject(new Error('reCAPTCHA script failed to load'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * reCAPTCHA v3 like peregrine `useGoogleReCaptcha`, driven by Magento's
 * `recaptchaV3Config`. `execute` answers a fresh token (one per Magento call)
 * or null when the form does not need one or the script cannot load: the
 * action then runs without it and Magento decides.
 */
export function useRecaptcha(form: RecaptchaForm) {
  useEffect(() => {
    void loadConfig().then((config) => {
      if (config && isRecaptchaEnabled(config, form))
        void loadScript(config).catch(() => undefined);
    });
  }, [form]);

  return useCallback(
    async (action: string): Promise<string | null> => {
      try {
        const config = await loadConfig();
        if (!config || !isRecaptchaEnabled(config, form)) return null;
        await loadScript(config);
        return (await grecaptcha()?.execute(config.siteKey, { action })) ?? null;
      } catch {
        return null;
      }
    },
    [form],
  );
}
