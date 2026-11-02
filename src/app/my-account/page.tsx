import type { Metadata } from 'next';
import { AccountDashboard } from '@/modules/account/ui/account-dashboard';

export const metadata: Metadata = { title: 'Mi cuenta' };

export default function MyAccountRoute() {
  return <AccountDashboard />;
}
