interface CmsPageProps {
  readonly identifier: string;
}

/**
 * Dispatcher for Magento CMS pages resolved by the catch-all route. T6
 * replaces this placeholder with the Page Builder renderer; the page
 * metadata keeps CMS pages noindex until then.
 */
export function CmsPage({ identifier }: CmsPageProps) {
  return (
    <main
      className="mx-auto max-w-3xl px-4 py-8"
      data-testid="cms-placeholder"
      data-identifier={identifier}
    >
      <p className="text-neutral-700">Contenido en preparación.</p>
    </main>
  );
}
