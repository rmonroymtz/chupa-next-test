'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { CustomerProfile } from '@/modules/customer/application/ports';

interface AccountProfileValue {
  readonly profile: CustomerProfile;
  /** The sign-in token the shell read; account pages pass it to their Server Actions. */
  readonly token: string;
}

const AccountProfileContext = createContext<AccountProfileValue | null>(null);

export function AccountProfileProvider({
  profile,
  token = '',
  children,
}: {
  readonly profile: CustomerProfile;
  readonly token?: string;
  readonly children: ReactNode;
}) {
  return (
    <AccountProfileContext.Provider value={{ profile, token }}>
      {children}
    </AccountProfileContext.Provider>
  );
}

/** The signed-in customer, inside the account shell. Throws outside it: a page without the guard is a bug. */
export function useAccountProfile(): AccountProfileValue {
  const value = useContext(AccountProfileContext);
  if (!value) throw new Error('useAccountProfile must be used inside the account shell');
  return value;
}
