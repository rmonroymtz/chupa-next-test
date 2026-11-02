import type { CustomerAddress } from '@/modules/address/application/ports';

/** Full name of an address: first, middle and last name, blanks skipped. */
export function addressFullName(address: CustomerAddress): string {
  return [address.firstName, address.middleName, address.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
}

/** Legacy list order: the default shipping address first, the rest as Magento sends them. */
export function sortAddresses(addresses: readonly CustomerAddress[]): CustomerAddress[] {
  return [...addresses].sort((a, b) => Number(b.defaultShipping) - Number(a.defaultShipping));
}

/** "city, region" of a card; either part may be missing. */
export function cityRegionLine(address: CustomerAddress): string {
  return [address.city, address.region.name].filter((part) => part.trim() !== '').join(', ');
}
