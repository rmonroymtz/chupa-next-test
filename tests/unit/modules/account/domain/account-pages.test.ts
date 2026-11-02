import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_ALIASES,
  accountAliasRedirects,
  avatarInitials,
  buildBreadcrumb,
  DASHBOARD_CARDS,
  dashboardGreeting,
  parseCallbackUrl,
} from '@/modules/account/domain/account-pages';

describe('DASHBOARD_CARDS', () => {
  it('lists the six legacy cards in order with their links', () => {
    expect(DASHBOARD_CARDS.map((card) => [card.title, card.href])).toEqual([
      ['Órdenes y facturación', '/my-account/order-history'],
      ['Cotizaciones', '/my-account/quotes'],
      ['Direcciones', '/my-account/address-book'],
      ['Tarjetas', '/my-account/saved-payments'],
      ['Atención al cliente', '/my-account/support'],
      ['Perfil', '/my-account/account-information'],
    ]);
  });

  it('keeps the legacy descriptions', () => {
    expect(DASHBOARD_CARDS[1]?.description).toBe(
      'Consulta aquí todas las cotizaciones que has generado. Recuerda que cada cotización es válida por 5 días.',
    );
    expect(DASHBOARD_CARDS[5]?.description).toBe(
      'Puedes revisar y editar tus datos personales esenciales, actualizar tu contraseña y activar la Verificación en 2 pasos.',
    );
  });
});

describe('dashboardGreeting and avatarInitials', () => {
  it('greets by first and last name', () => {
    expect(dashboardGreeting({ firstName: 'Ana', lastName: 'Pérez' })).toBe('Hola, Ana Pérez');
    expect(avatarInitials({ firstName: 'Ana', lastName: 'Pérez' })).toBe('AP');
  });

  it('falls back to "Usuario" and "U" without a name', () => {
    expect(dashboardGreeting({ firstName: ' ', lastName: '' })).toBe('Hola, Usuario');
    expect(avatarInitials({ firstName: '', lastName: '' })).toBe('U');
  });
});

describe('accountAliasRedirects', () => {
  it('sends each legacy alias to the same path under /my-account, temporarily', () => {
    expect(ACCOUNT_ALIASES).toEqual([
      '/order-history',
      '/account-information',
      '/address-book',
      '/saved-payments',
      '/quotes',
    ]);
    expect(accountAliasRedirects()).toEqual([
      { source: '/order-history', destination: '/my-account/order-history', permanent: false },
      {
        source: '/account-information',
        destination: '/my-account/account-information',
        permanent: false,
      },
      { source: '/address-book', destination: '/my-account/address-book', permanent: false },
      { source: '/saved-payments', destination: '/my-account/saved-payments', permanent: false },
      { source: '/quotes', destination: '/my-account/quotes', permanent: false },
    ]);
  });
});

describe('parseCallbackUrl', () => {
  it('accepts a same-site path, raw or JSON-encoded', () => {
    expect(parseCallbackUrl('/my-account/order-history')).toBe('/my-account/order-history');
    expect(parseCallbackUrl(JSON.stringify('/my-account/quotes'))).toBe('/my-account/quotes');
  });

  it('rejects external, protocol-relative and malformed values', () => {
    expect(parseCallbackUrl('https://evil.example/x')).toBeNull();
    expect(parseCallbackUrl('//evil.example')).toBeNull();
    expect(parseCallbackUrl('/a\\b')).toBeNull();
    expect(parseCallbackUrl('javascript:alert(1)')).toBeNull();
    expect(parseCallbackUrl(undefined)).toBeNull();
    expect(parseCallbackUrl('')).toBeNull();
  });
});

describe('buildBreadcrumb', () => {
  it('builds one crumb per segment with the legacy labels, linking all but the last', () => {
    expect(buildBreadcrumb('/my-account/address-book')).toEqual([
      { label: 'Mi cuenta', href: '/my-account' },
      { label: 'Mis direcciones', href: null },
    ]);
  });

  it('labels the account information pages', () => {
    expect(buildBreadcrumb('/my-account/edit-account-information').map((c) => c.label)).toEqual([
      'Mi cuenta',
      'Editar datos',
    ]);
    expect(buildBreadcrumb('/my-account/support').at(-1)?.label).toBe('Atención a clientes');
  });

  it('hides numeric segments and links only real pages on nested paths', () => {
    expect(buildBreadcrumb('/my-account/address-book/edit/42')).toEqual([
      { label: 'Mi cuenta', href: '/my-account' },
      { label: 'Mis direcciones', href: '/my-account/address-book' },
      { label: 'Editar dirección', href: null },
    ]);
    expect(buildBreadcrumb('/my-account/address-book/new')).toEqual([
      { label: 'Mi cuenta', href: '/my-account' },
      { label: 'Mis direcciones', href: '/my-account/address-book' },
      { label: 'Agregar dirección', href: null },
    ]);
  });

  it('points the previous crumb to the callback url when it is a valid path', () => {
    expect(buildBreadcrumb('/my-account/address-book/new', '/checkout')).toEqual([
      { label: 'Mi cuenta', href: '/my-account' },
      { label: 'Mis direcciones', href: '/checkout' },
      { label: 'Agregar dirección', href: null },
    ]);
    expect(buildBreadcrumb('/my-account/support', 'https://evil.example')[0]?.href).toBe(
      '/my-account',
    );
  });

  it('skips unknown segments', () => {
    expect(buildBreadcrumb('/my-account/whatever').map((c) => c.label)).toEqual(['Mi cuenta']);
  });

  it('is just "Mi cuenta" on the dashboard', () => {
    expect(buildBreadcrumb('/my-account')).toEqual([{ label: 'Mi cuenta', href: null }]);
  });
});
