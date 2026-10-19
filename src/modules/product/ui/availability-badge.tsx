import type { Availability } from '@/modules/product/domain/product';

const LABELS: Record<Availability, { text: string; className: string }> = {
  in_stock: { text: 'Disponible', className: 'bg-ds-success-bg text-ds-text' },
  out_of_stock: { text: 'Agotado', className: 'bg-ds-error-bg text-ds-text' },
  unknown: { text: 'Consulta disponibilidad', className: 'bg-ds-surface-subtle text-ds-text' },
};

export function AvailabilityBadge({ availability }: { readonly availability: Availability }) {
  const label = LABELS[availability];
  return (
    <p
      className={`inline-flex w-fit rounded-xs px-2 py-1 text-sm font-medium ${label.className}`}
      data-testid="product-availability"
      data-availability={availability}
    >
      {label.text}
    </p>
  );
}
