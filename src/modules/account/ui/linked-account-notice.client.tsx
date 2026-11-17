'use client';

import { useEffect, useState } from 'react';
import type { LinkedSocialAccount } from '@/modules/customer/application/ports';
import { requestPasswordResetAction } from '@/modules/customer/ui/customer-actions';
import { FormError } from '@/modules/customer/ui/form-error';
import { getLinkedSocialAccountsAction } from '@/modules/customer/ui/social-login-actions';
import { useRecaptcha } from '@/modules/customer/ui/use-recaptcha';
import { Button } from '@/shared/ui/button';

/**
 * Networks linked to the customer (Amasty `amSocialLoginAccountData`).
 * `loading` until Magento answers; a failed read counts as none.
 */
export function useLinkedSocialAccounts(token: string): {
  readonly loading: boolean;
  readonly accounts: readonly LinkedSocialAccount[];
} {
  const [state, setState] = useState<{
    loading: boolean;
    accounts: readonly LinkedSocialAccount[];
  }>({ loading: true, accounts: [] });

  useEffect(() => {
    let active = true;
    getLinkedSocialAccountsAction({ token })
      .then((result) => {
        if (active) {
          setState({ loading: false, accounts: result.status === 'ok' ? result.accounts : [] });
        }
      })
      .catch(() => {
        if (active) setState({ loading: false, accounts: [] });
      });
    return () => {
      active = false;
    };
  }, [token]);

  return state;
}

interface LinkedAccountNoticeProps {
  readonly accounts: readonly LinkedSocialAccount[];
  readonly email: string;
}

/**
 * Legacy "Cuenta vinculada con" block of the profile edit: a customer who
 * signed up with a network may have no password of their own, so the page
 * offers the reset email instead of the password change.
 */
export function LinkedAccountNotice({ accounts, email }: LinkedAccountNoticeProps) {
  const getToken = useRecaptcha('CUSTOMER_FORGOT_PASSWORD');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  async function sendResetEmail(): Promise<void> {
    if (sending) return;
    setSending(true);
    setFailed(false);
    try {
      const result = await requestPasswordResetAction({
        email,
        recaptchaToken: await getToken('forgotPassword'),
      });
      if (result.status === 'sent') setSent(true);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-ds-border bg-ds-surface-subtle p-4">
      <p className="font-semibold text-ds-text">
        {`Cuenta vinculada con ${accounts.map((account) => account.name).join(' y ')}`}
      </p>
      {sent ? (
        <p role="status" className="text-sm text-ds-text">
          ✓ Enviamos las instrucciones a <strong>{email}</strong>. Revisa tu bandeja de entrada y
          spam.
        </p>
      ) : (
        <>
          <p className="text-sm text-ds-text-secondary">
            Tu cuenta no tiene contraseña propia establecida. Podemos enviarte un correo para que
            crees una.
          </p>
          <FormError message={failed ? 'No pudimos enviar el correo. Intenta de nuevo.' : null} />
          <Button
            type="button"
            variant="secondary"
            loading={sending}
            onClick={() => void sendResetEmail()}
            className="self-start"
          >
            {sending ? 'Enviando...' : 'Enviar correo de restablecimiento'}
          </Button>
        </>
      )}
    </div>
  );
}
