import type { Metadata } from 'next';
import { authHref, resolveRedirect } from '@/modules/customer/domain/auth-forms';
import { AuthPage } from '@/modules/customer/ui/auth-page';
import { SignInForm } from '@/modules/customer/ui/sign-in-form.client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Iniciar sesión',
  robots: { index: false, follow: false },
};

interface RouteProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SignInRoute({ searchParams }: RouteProps) {
  const { from } = await searchParams;
  const origin = typeof from === 'string' ? from : undefined;
  return (
    <AuthPage title="Inicia sesión" subtitle="Bienvenido de nuevo a Chupaprecios">
      <SignInForm
        // The PWA sends signed-in shoppers to their previous page, else the account.
        redirectTo={resolveRedirect(origin, '/my-account')}
        createAccountHref={authHref('/create-account', origin)}
        forgotPasswordHref={authHref('/forgot-password', origin)}
      />
    </AuthPage>
  );
}
