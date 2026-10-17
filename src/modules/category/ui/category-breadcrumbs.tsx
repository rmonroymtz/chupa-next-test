import type { Category } from '@/modules/category/domain/category';
import { LEGACY_ROUTES } from '@/modules/layout/domain/legacy-routes';

/**
 * Inicio → parent categories → the current category (not a link). Plain
 * anchors like the menu: full navigation, no Next prefetch.
 */
export function CategoryBreadcrumbs({ category }: { readonly category: Category }) {
  const links = [{ name: 'Inicio', url: LEGACY_ROUTES.home }, ...category.breadcrumbs];
  return (
    <nav aria-label="Ruta de navegación" className="mb-4 text-sm text-ds-text-secondary">
      <ol className="flex flex-wrap items-center gap-x-2">
        {links.map((link) => (
          <li key={link.url} className="flex items-center gap-x-2">
            <a href={link.url} className="hover:underline">
              {link.name}
            </a>
            <span aria-hidden="true">/</span>
          </li>
        ))}
        <li>
          <span aria-current="page" className="font-semibold text-ds-text">
            {category.name}
          </span>
        </li>
      </ol>
    </nav>
  );
}
