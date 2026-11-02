import type { Metadata } from 'next';
import { AddressForm } from '@/modules/account/ui/address-form.client';

export const metadata: Metadata = { title: 'Nueva dirección' };

export default function NewAddressRoute() {
  return <AddressForm />;
}
