import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AccountShell } from '@/modules/account/ui/account-shell.client';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Frame of the account area: the guard, the breadcrumb and the profile are the
 * client shell's job (the session lives in the browser's storage).
 */
export default function MyAccountLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8">
      <AccountShell>{children}</AccountShell>
    </div>
  );
}
