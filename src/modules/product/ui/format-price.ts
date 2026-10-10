const formatters = new Map<string, Intl.NumberFormat>();

/**
 * Formats an amount exactly as returned by the source (no conversion or
 * rounding beyond the currency's minor units), with es-MX conventions.
 */
export function formatPrice(amount: number, currency: string): string {
  try {
    let formatter = formatters.get(currency);
    if (!formatter) {
      formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency });
      formatters.set(currency, formatter);
    }
    return formatter.format(amount);
  } catch {
    // Invalid ISO code (or malformed runtime value) from the source: still show
    // the amount, never break the page.
    return fallbackPrice(amount, currency);
  }
}

function fallbackPrice(amount: unknown, currency: unknown): string {
  const value =
    typeof amount === 'number' ? amount : Number(typeof amount === 'string' ? amount : NaN);
  const code = typeof currency === 'string' ? currency : '';
  return `${Number.isFinite(value) ? value.toFixed(2) : ''} ${code}`.trim();
}
