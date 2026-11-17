import type { Metadata } from 'next';
import { authHref, resolveRedirect } from '@/modules/customer/domain/auth-forms';
import { getSocialLoginService } from '@/modules/customer/infrastructure/customer.composition';
import { AuthPage } from '@/modules/customer/ui/auth-page';
import { SocialButtons } from '@/modules/customer/ui/social-buttons.client';
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
  const redirectTo = resolveRedirect(origin, '/order-history');
  // Amasty social buttons; none when Magento does not offer them or cannot answer.
  const socialButtons = await getSocialLoginService().getButtons();
  return (
    <AuthPage title="Crear cuenta">
      <CreateAccountForm
        // The PWA sends a new customer to their previous page, else the order history.
        redirectTo={redirectTo}
        signInHref={authHref('/sign-in', origin)}
        social={<SocialButtons buttons={socialButtons} redirectTo={redirectTo} />}
      />
    </AuthPage>
  );
}
