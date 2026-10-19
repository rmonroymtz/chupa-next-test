/**
 * Fallback while the scraped product streams in. Mirrors the PDP layout
 * (square gallery, text column) so the swap causes no layout shift.
 */
export function ProductSkeleton() {
  return (
    <div
      className="container-padded py-8"
      data-testid="pdp-skeleton"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Cargando producto…</span>
      <div className="grid animate-pulse gap-8 lg:grid-cols-2" aria-hidden="true">
        <div className="aspect-square w-full rounded-md bg-ds-neutral-200" />
        <div className="flex flex-col gap-4">
          <div className="h-4 w-1/4 rounded-xs bg-ds-neutral-200" />
          <div className="h-8 w-3/4 rounded-xs bg-ds-neutral-200" />
          <div className="h-10 w-1/3 rounded-xs bg-ds-neutral-200" />
          <div className="h-6 w-1/5 rounded-xs bg-ds-neutral-200" />
          <div className="h-24 w-full rounded-xs bg-ds-neutral-200" />
        </div>
      </div>
    </div>
  );
}
