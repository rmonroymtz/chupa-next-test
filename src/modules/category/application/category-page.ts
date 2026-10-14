import type {
  CategoryProductsRepository,
  CategoryRepository,
} from '@/modules/category/application/ports';
import type { Category, CategoryProductPage } from '@/modules/category/domain/category';
import { parsePageParam, withoutPageParam } from '@/modules/category/domain/category-page-param';
import { toLocation } from '@/modules/routing/domain/request-path';

/**
 * How a category resolved by Magento `route()` is served:
 * - `not_found`: Magento has no such category (404);
 * - `redirect`: the requested `?page` is invalid or beyond the last page, so
 *   the request goes to the clean category url (the first page) with the
 *   other query parameters kept;
 * - `page`: the category and the requested page of its products. An empty
 *   category is served (200) but must not be indexed. The canonical path is
 *   always the clean category url, whatever page is shown.
 *
 * A Magento failure never resolves: it rejects, so it is served as a 5xx.
 */
export type CategoryPageResolution =
  | { readonly kind: 'not_found' }
  | { readonly kind: 'redirect'; readonly location: string }
  | {
      readonly kind: 'page';
      readonly category: Category;
      readonly listing: CategoryProductPage;
      readonly indexable: boolean;
      /** Clean category url without the leading slash, page or query (for `buildCanonicalUrl`). */
      readonly canonicalPath: string;
    };

export interface CategoryPageRequest {
  /** Category uid Magento `route()` resolved the pathname to. */
  readonly uid: string;
  /** Request query string as built by `toSearch` (no leading `?`). */
  readonly search: string;
}

export interface CategoryPageDeps {
  readonly categories: CategoryRepository;
  readonly products: CategoryProductsRepository;
  /** Products per page (`storeConfig.grid_per_page`); rejects when Magento fails. */
  readonly getPageSize: () => Promise<number>;
}

const NOT_FOUND: CategoryPageResolution = { kind: 'not_found' };

/**
 * Decides how a Magento-routed category page is served. The category and its
 * products are read concurrently; a missing category wins over any product
 * outcome, so it is always a 404 and never a 5xx or a redirect.
 */
export async function resolveCategoryPage(
  { uid, search }: CategoryPageRequest,
  { categories, products, getPageSize }: CategoryPageDeps,
): Promise<CategoryPageResolution> {
  const pageParam = parsePageParam(search);
  if (pageParam.kind === 'invalid') {
    const category = await categories.findByUid(uid);
    return category ? redirectToFirstPage(category, search) : NOT_FOUND;
  }

  const [categoryOutcome, productsOutcome] = await Promise.allSettled([
    categories.findByUid(uid),
    getPageSize().then((pageSize) =>
      products.findPage({ categoryUid: uid, currentPage: pageParam.page, pageSize }),
    ),
  ]);
  if (categoryOutcome.status === 'rejected') throw categoryOutcome.reason;
  const category = categoryOutcome.value;
  if (!category) return NOT_FOUND;
  if (productsOutcome.status === 'rejected') throw productsOutcome.reason;

  const result = productsOutcome.value;
  // The redirect target is the first page: refusing it would loop, so it is a failure (5xx).
  if (result.kind === 'out_of_range' && pageParam.page === 1) {
    throw new Error(`Magento refused the first page of category ${uid}`);
  }
  // An empty category has zero pages but still renders its first page.
  if (result.kind === 'out_of_range' || pageParam.page > Math.max(result.page.totalPages, 1)) {
    return redirectToFirstPage(category, search);
  }
  return {
    kind: 'page',
    category,
    listing: result.page,
    indexable: result.page.totalCount > 0,
    canonicalPath: category.url.replace(/^\/+/, ''),
  };
}

function redirectToFirstPage(category: Category, search: string): CategoryPageResolution {
  return { kind: 'redirect', location: toLocation(category.url, withoutPageParam(search)) };
}
