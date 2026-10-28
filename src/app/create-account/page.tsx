import type { Metadata } from 'next';
import { authHref, resolveRedirect } from '@/modules/customer/domain/auth-forms';
import { AuthPage } from '@/modules/customer/ui/auth-page';
import { CreateAccountForm } from '@/modules/customer/ui/create-account-form.client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Crear cuenta',
  robots: { index: false, follow: false },
};

interface RouteProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CreateAccountRoute({ searchParams }: RouteProps) {
  const { from } = await searchParams;
  const origin = typeof from === 'string' ? from : undefined;
  return (
    <AuthPage title="Crear cuenta">
      <CreateAccountForm
        // The PWA sends a new customer to their previous page, else the order history.
        redirectTo={resolveRedirect(origin, '/order-history')}
        signInHref={authHref('/sign-in', origin)}
      />
    </AuthPage>
  );
}
