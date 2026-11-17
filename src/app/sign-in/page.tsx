import type { Metadata } from 'next';
import { authHref, resolveRedirect } from '@/modules/customer/domain/auth-forms';
import { getSocialLoginService } from '@/modules/customer/infrastructure/customer.composition';
import { AuthPage } from '@/modules/customer/ui/auth-page';
import { SocialButtons } from '@/modules/customer/ui/social-buttons.client';
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
  const redirectTo = resolveRedirect(origin, '/my-account');
  // Amasty social buttons; none when Magento does not offer them or cannot answer.
  const socialButtons = await getSocialLoginService().getButtons();
  return (
    <AuthPage title="Inicia sesión" subtitle="Bienvenido de nuevo a Chupaprecios">
      <SignInForm
        // The PWA sends signed-in shoppers to their previous page, else the account.
        redirectTo={redirectTo}
        createAccountHref={authHref('/create-account', origin)}
        forgotPasswordHref={authHref('/forgot-password', origin)}
      />
      <SocialButtons
        buttons={socialButtons}
        redirectTo={redirectTo}
        createAccountHref={authHref('/create-account', origin)}
      />
    </AuthPage>
  );
}
