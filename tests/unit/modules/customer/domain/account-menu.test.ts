import { describe, expect, it } from 'vitest';
import { ACCOUNT_MENU_ITEMS, customerInitials } from '@/modules/customer/domain/account-menu';

describe('ACCOUNT_MENU_ITEMS', () => {
  it('lists the legacy account menu, all served by the PWA', () => {
    expect(ACCOUNT_MENU_ITEMS.map((item) => [item.label, item.href])).toEqual([
      ['Mi cuenta', '/my-account'],
      ['Órdenes y facturación', '/my-account/order-history'],
      ['Cotizaciones', '/my-account/quotes'],
      ['Direcciones', '/my-account/address-book'],
      ['Tarjetas', '/my-account/saved-payments'],
      ['Atención al cliente', '/my-account/support'],
      ['Perfil', '/my-account/account-information'],
    ]);
  });
});

describe('customerInitials', () => {
  it('uses the first letters of the first and last name, upper-cased', () => {
    expect(customerInitials({ firstName: 'ana', lastName: 'pérez' })).toBe('AP');
  });

  it('falls back to what exists and to an empty string', () => {
    expect(customerInitials({ firstName: 'Ana', lastName: '' })).toBe('A');
    expect(customerInitials({ firstName: ' ', lastName: ' ' })).toBe('');
  });
});
