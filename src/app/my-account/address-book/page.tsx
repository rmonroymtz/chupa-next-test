import type { Metadata } from 'next';
import { AddressBook } from '@/modules/account/ui/address-book.client';

export const metadata: Metadata = { title: 'Mis direcciones' };

export default function AddressBookRoute() {
  return <AddressBook />;
}
