/**
 * Account menu of the legacy PWA header (`useAccountMenuItems`, copy from
 * `es_MX.json`). Every target is a page PWA Studio still serves, so the menu
 * uses plain anchors.
 */
export const ACCOUNT_MENU_ITEMS = [
  { label: 'Mi cuenta', href: '/my-account' },
  { label: 'Órdenes y facturación', href: '/my-account/order-history' },
  { label: 'Cotizaciones', href: '/my-account/quotes' },
  { label: 'Direcciones', href: '/my-account/address-book' },
  { label: 'Tarjetas', href: '/my-account/saved-payments' },
  { label: 'Atención al cliente', href: '/my-account/support' },
  { label: 'Perfil', href: '/my-account/account-information' },
] as const;

export function customerInitials(customer: {
  readonly firstName: string;
  readonly lastName: string;
}): string {
  return [customer.firstName, customer.lastName]
    .map((name) => name.trim().charAt(0).toUpperCase())
    .join('');
}
