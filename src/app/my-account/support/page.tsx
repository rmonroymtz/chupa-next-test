import type { Metadata } from 'next';
import { SupportPage } from '@/modules/account/ui/support-page';

export const metadata: Metadata = { title: 'Atención a clientes' };

export default function SupportRoute() {
  return <SupportPage />;
}
