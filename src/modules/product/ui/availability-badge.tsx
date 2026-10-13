import type { Availability } from '@/modules/product/domain/product';

const LABELS: Record<Availability, { text: string; className: string }> = {
  in_stock: { text: 'Disponible', className: 'bg-green-50 text-green-800' },
  out_of_stock: { text: 'Agotado', className: 'bg-red-50 text-red-800' },
  unknown: { text: 'Consulta disponibilidad', className: 'bg-neutral-100 text-neutral-700' },
};

export function AvailabilityBadge({ availability }: { readonly availability: Availability }) {
  const label = LABELS[availability];
  return (
    <p
      className={`inline-flex w-fit rounded px-2 py-1 text-sm font-medium ${label.className}`}
      data-testid="product-availability"
      data-availability={availability}
    >
      {label.text}
    </p>
  );
}
