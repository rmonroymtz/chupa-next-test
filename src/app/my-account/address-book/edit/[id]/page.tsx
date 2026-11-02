import type { Metadata } from 'next';
import { AddressForm } from '@/modules/account/ui/address-form.client';

export const metadata: Metadata = { title: 'Editar dirección' };

interface RouteProps {
  readonly params: Promise<{ id: string }>;
}

/**
 * Address ids are positive integers. Any other value is passed as id 0, which no
 * address has, so the form shows "No encontramos esta dirección." A real 404
 * is not possible here: under the account layout the status is already sent when
 * `notFound()` runs, and these pages are private and `noindex` anyway.
 */
export default async function EditAddressRoute({ params }: RouteProps) {
  const { id } = await params;
  return <AddressForm addressId={/^[1-9]\d{0,9}$/.test(id) ? Number(id) : 0} />;
}
