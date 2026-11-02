import type { Metadata } from 'next';
import { authHref } from '@/modules/customer/domain/auth-forms';
import { AuthPage } from '@/modules/customer/ui/auth-page';
import { ForgotPasswordForm } from '@/modules/customer/ui/forgot-password-form.client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Recuperar contraseña',
  robots: { index: false, follow: false },
};

interface RouteProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ForgotPasswordRoute({ searchParams }: RouteProps) {
  const { from } = await searchParams;
  return (
    <AuthPage title="Recuperar contraseña">
      <ForgotPasswordForm
        signInHref={authHref('/sign-in', typeof from === 'string' ? from : undefined)}
      />
    </AuthPage>
  );
}
