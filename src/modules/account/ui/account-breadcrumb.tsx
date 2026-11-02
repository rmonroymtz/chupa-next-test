import type { Crumb } from '@/modules/account/domain/account-pages';

/** Legacy `Breadcrumb`: the path of the account area, the last crumb is the current page. */
export function AccountBreadcrumb({ crumbs }: { readonly crumbs: readonly Crumb[] }) {
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="Ruta de navegación" className="text-sm text-ds-text-secondary">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {crumbs.map((crumb, index) => (
          <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {crumb.href ? (
              <a
                href={crumb.href}
                className="rounded-xs hover:text-ds-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus"
              >
                {crumb.label}
              </a>
            ) : (
              <span aria-current="page" className="font-semibold text-ds-text">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
