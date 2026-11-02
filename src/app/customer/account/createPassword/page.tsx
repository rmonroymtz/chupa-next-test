import type { Metadata } from 'next';
import { AuthPage } from '@/modules/customer/ui/auth-page';
import { ResetPasswordForm } from '@/modules/customer/ui/reset-password-form.client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Restablecer contraseña',
  robots: { index: false, follow: false },
  // The reset token travels in the query string: no Referer to third parties (reCAPTCHA, help links).
  referrer: 'no-referrer',
};

interface RouteProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The reset-password link target baked into Magento's email template. Only
 * `token` is read (the legacy ignores `id` too); the edge must send this exact
 * path to Next.
 */
export default async function CreatePasswordRoute({ searchParams }: RouteProps) {
  const { token } = await searchParams;
  return (
    <AuthPage title="Restablecer contraseña">
      <ResetPasswordForm token={typeof token === 'string' && token !== '' ? token : null} />
    </AuthPage>
  );
}
