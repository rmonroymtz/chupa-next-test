interface ProductUnavailableProps {
  /** Legacy search for similar products (served by PWA Studio). */
  readonly searchUrl: string;
}

/**
 * Shown when a product cannot be loaded. Plain anchors: search and home are
 * served by PWA Studio, not by this app, so client-side navigation would fail.
 */
export function ProductUnavailable({ searchUrl }: ProductUnavailableProps) {
  return (
    <section
      className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center"
      data-testid="product-unavailable"
    >
      <h1 className="text-2xl font-semibold text-neutral-900">Producto no disponible</h1>
      <p className="text-neutral-700">
        No pudimos obtener la información de este producto en este momento. Puedes buscar productos
        similares o volver al inicio.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <a href={searchUrl} className="rounded bg-neutral-900 px-4 py-2 font-medium text-white">
          Buscar productos similares
        </a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- home is served by PWA Studio in phase 1 */}
        <a href="/" className="rounded border border-neutral-300 px-4 py-2 font-medium">
          Ir al inicio
        </a>
      </div>
    </section>
  );
}
