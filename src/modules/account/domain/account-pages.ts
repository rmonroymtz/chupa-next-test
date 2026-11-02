/**
 * Pure rules of the account area, from the legacy PWA `@chupaprecios/dashboard`
 * (`Dashboard`, `Breadcrumb`, `DashboardRedirect`). Copy is the legacy Spanish.
 */

export interface DashboardCard {
  readonly title: string;
  readonly href: string;
  readonly description: string;
}

/** The six dashboard cards, in the legacy order. */
export const DASHBOARD_CARDS: readonly DashboardCard[] = [
  {
    title: 'Órdenes y facturación',
    href: '/my-account/order-history',
    description:
      'Sigue el estado de tus pedidos, desde la preparación hasta la entrega, y revisa todos los detalles de tus compras.',
  },
  {
    title: 'Cotizaciones',
    href: '/my-account/quotes',
    description:
      'Consulta aquí todas las cotizaciones que has generado. Recuerda que cada cotización es válida por 5 días.',
  },
  {
    title: 'Direcciones',
    href: '/my-account/address-book',
    description: 'Administra fácilmente todas tus direcciones guardadas para envíos.',
  },
  {
    title: 'Tarjetas',
    href: '/my-account/saved-payments',
    description:
      'Agregar, editar o eliminar tarjetas de crédito y débito, y otras opciones disponibles.',
  },
  {
    title: 'Atención al cliente',
    href: '/my-account/support',
    description:
      '¿Tienes alguna duda o necesitas ayuda? Usa esta sección para contactar a nuestro equipo.',
  },
  {
    title: 'Perfil',
    href: '/my-account/account-information',
    description:
      'Puedes revisar y editar tus datos personales esenciales, actualizar tu contraseña y activar la Verificación en 2 pasos.',
  },
];

interface NamedCustomer {
  readonly firstName: string;
  readonly lastName: string;
}

const fullName = (customer: NamedCustomer): string =>
  [customer.firstName, customer.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');

/** Legacy greeting: "Hola, {firstname lastname}", "Usuario" without a name. */
export function dashboardGreeting(customer: NamedCustomer): string {
  return `Hola, ${fullName(customer) || 'Usuario'}`;
}

/** Initials of the avatar; "U" without a name (legacy fallback). */
export function avatarInitials(customer: NamedCustomer): string {
  const initials = [customer.firstName, customer.lastName]
    .map((part) => part.trim().charAt(0).toUpperCase())
    .join('');
  return initials || 'U';
}

/**
 * Venia routes the legacy PWA redirects into `/my-account` (`DashboardRedirect`):
 * old emails and bookmarks still use them.
 */
export const ACCOUNT_ALIASES = [
  '/order-history',
  '/account-information',
  '/address-book',
  '/saved-payments',
  '/quotes',
] as const;

/**
 * `next.config` redirects for the aliases. Temporary (307) on purpose: a
 * browser must not cache the hop if the edge sends the aliases back to the PWA.
 * Next keeps the query string.
 */
export function accountAliasRedirects(): {
  source: string;
  destination: string;
  permanent: false;
}[] {
  return ACCOUNT_ALIASES.map((source) => ({
    source,
    destination: `/my-account${source}`,
    permanent: false,
  }));
}

const BREADCRUMB_LABELS: Readonly<Record<string, string>> = {
  'my-account': 'Mi cuenta',
  'order-history': 'Mis órdenes',
  'address-book': 'Mis direcciones',
  'account-information': 'Mi perfil',
  'edit-account-information': 'Editar datos',
  new: 'Agregar dirección',
  edit: 'Editar dirección',
  quotes: 'Mis cotizaciones',
  support: 'Atención a clientes',
  'saved-payments': 'Mis tarjetas',
  'billing-address': 'Datos de facturación',
};

export interface Crumb {
  readonly label: string;
  /** Null for the current page. */
  readonly href: string | null;
}

/**
 * The `callbackUrl` of the legacy breadcrumb: a raw path or a JSON-encoded
 * string, only when it is a path on this site.
 */
export function parseCallbackUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let value: unknown = raw;
  try {
    value = JSON.parse(raw);
  } catch {
    // A raw path is not JSON.
  }
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (/[\\\u0000-\u001f]/.test(value)) return null;
  return value;
}

/**
 * Legacy breadcrumb: one crumb per known path segment (numeric ids hidden,
 * unknown segments skipped); every crumb but the last links to its path. A
 * valid `callbackUrl` replaces the link of the crumb before the last one, so
 * "back" returns where the shopper came from.
 */
export function buildBreadcrumb(pathname: string, callbackUrl?: string | null): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; path: string }[] = [];
  segments.forEach((segment, index) => {
    const label = BREADCRUMB_LABELS[segment];
    if (label === undefined) return;
    crumbs.push({ label, path: `/${segments.slice(0, index + 1).join('/')}` });
  });
  const callback = parseCallbackUrl(callbackUrl);
  return crumbs.map((crumb, index) => {
    const last = index === crumbs.length - 1;
    if (last) return { label: crumb.label, href: null };
    const beforeLast = index === crumbs.length - 2;
    return { label: crumb.label, href: beforeLast && callback ? callback : crumb.path };
  });
}
