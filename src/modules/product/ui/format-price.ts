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
    // Invalid ISO code from the source: still show the amount, never break the page.
    return `${amount.toFixed(2)} ${currency}`;
  }
}
