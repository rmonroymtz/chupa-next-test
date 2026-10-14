import type { Category, CategoryProductPage } from '@/modules/category/domain/category';
import { buildCanonicalUrl } from '@/modules/product/domain/product-url';
import {
  buildBreadcrumbListJsonLd,
  type BreadcrumbListJsonLd,
} from '@/modules/seo/domain/breadcrumb-list';
import { siteRootUrl } from '@/modules/seo/domain/site';

interface CategoryJsonLdOptions {
  /** Public site origin (`PUBLIC_BASE_URL`). */
  readonly baseUrl: string;
}

export interface CollectionPageJsonLd {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'CollectionPage';
  readonly name: string;
  readonly url: string;
  readonly mainEntity: {
    readonly '@type': 'ItemList';
    readonly itemListElement: readonly {
      readonly '@type': 'ListItem';
      readonly position: number;
      readonly url: string;
      readonly name: string;
    }[];
  };
}

/**
 * Inicio → parent categories → the category, with absolute urls: the same
 * trail the page shows. Category urls are built like the canonical tag.
 */
export function buildCategoryBreadcrumbJsonLd(
  category: Category,
  { baseUrl }: CategoryJsonLdOptions,
): BreadcrumbListJsonLd {
  return buildBreadcrumbListJsonLd([
    { name: 'Inicio', item: siteRootUrl(baseUrl) },
    ...[...category.breadcrumbs, category].map((link) => ({
      name: link.name,
      item: buildCanonicalUrl(baseUrl, link.url),
    })),
  ]);
}

/**
 * The category as a `CollectionPage` at its clean url (the canonical, for
 * every page of the listing) whose `ItemList` holds the products shown on
 * the requested page. Positions count from the first product of the whole
 * category, so page 2 continues where page 1 ends.
 */
export function buildCategoryCollectionJsonLd(
  category: Category,
  listing: CategoryProductPage,
  { baseUrl }: CategoryJsonLdOptions,
): CollectionPageJsonLd {
  const offset = (listing.currentPage - 1) * listing.pageSize;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: category.name,
    url: buildCanonicalUrl(baseUrl, category.url),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: listing.items.map((product, index) => ({
        '@type': 'ListItem',
        position: offset + index + 1,
        url: buildCanonicalUrl(baseUrl, product.relativeUrl),
        name: product.name,
      })),
    },
  };
}
