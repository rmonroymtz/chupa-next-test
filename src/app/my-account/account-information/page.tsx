import type { Metadata } from 'next';
import { AccountInformationView } from '@/modules/account/ui/account-information-view';

export const metadata: Metadata = { title: 'Mi perfil' };

export default function AccountInformationRoute() {
  return <AccountInformationView />;
}
