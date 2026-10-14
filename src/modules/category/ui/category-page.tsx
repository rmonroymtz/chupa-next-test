import {
  isIndexableListing,
  type Category,
  type CategoryProductPage,
} from '@/modules/category/domain/category';
import { CategoryBreadcrumbs } from '@/modules/category/ui/category-breadcrumbs';
import { CategoryPagination } from '@/modules/category/ui/category-pagination';
import {
  buildCategoryBreadcrumbJsonLd,
  buildCategoryCollectionJsonLd,
} from '@/modules/category/ui/category-structured-data';
import { PageBuilderContent } from '@/modules/page-builder/ui/page-builder-content';
import { ProductCards } from '@/modules/page-builder/ui/product-cards';
import { getSiteConfig } from '@/modules/seo/infrastructure/site-config';
import { JsonLd } from '@/modules/seo/ui/json-ld';

interface CategoryPageProps {
  readonly category: Category;
  /** The requested page of the category's products (already validated). */
  readonly listing: CategoryProductPage;
  /** Request query string (no leading `?`), kept in the pagination links. */
  readonly search: string;
}

/**
 * Magento category page: breadcrumbs, name, description (Magento HTML through the Page
 * Builder renderer, which sanitizes it), the requested page of products and
 * the page links. An empty category shows an empty state (and is `noindex`).
 */
export function CategoryPage({ category, listing, search }: CategoryPageProps) {
  return (
    <div data-category-uid={category.uid} className="mx-auto max-w-[1280px] px-4 py-6">
      <CategoryStructuredData category={category} listing={listing} />
      <CategoryBreadcrumbs category={category} />
      <h1 className="text-2xl font-semibold">{category.name}</h1>
      {category.description ? (
        <PageBuilderContent content={category.description} source={`category:${category.uid}`} />
      ) : null}
      <div className="mt-6">
        {listing.items.length > 0 ? (
          <ProductCards cards={listing.items} appearance="grid" />
        ) : (
          <p className="py-12 text-center text-neutral-grey">No hay productos en esta categoría.</p>
        )}
      </div>
      <CategoryPagination
        url={category.url}
        search={search}
        currentPage={listing.currentPage}
        totalPages={listing.totalPages}
      />
    </div>
  );
}

/**
 * Structured data only for indexable categories, as the product page does for
 * Magento products: an empty category is `noindex`, so it gets none.
 */
function CategoryStructuredData({ category, listing }: Omit<CategoryPageProps, 'search'>) {
  if (!isIndexableListing(listing)) return null;
  const options = { baseUrl: getSiteConfig().baseUrl };
  return (
    <>
      <JsonLd data={buildCategoryBreadcrumbJsonLd(category, options)} />
      <JsonLd data={buildCategoryCollectionJsonLd(category, listing, options)} />
    </>
  );
}
