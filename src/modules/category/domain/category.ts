/**
 * Magento category and a page of its products. Pure domain code: no framework
 * imports and no I/O.
 */
import type { ProductCard } from '@/modules/product/domain/product';

/** A parent category, from the store root down to the category's parent. */
export interface CategoryBreadcrumb {
  readonly uid: string;
  readonly name: string;
  /** Category page url (`/{url_path}{suffix}`). */
  readonly url: string;
}

export interface Category {
  readonly uid: string;
  readonly name: string;
  /** Description HTML exactly as Magento returns it; null when blank. */
  readonly description: string | null;
  /** Magento `url_path`, e.g. `electronica/computacion/laptops` (no slashes around it). */
  readonly urlPath: string;
  /** Store `category_url_suffix` including the dot (e.g. `.html`); empty when unset. */
  readonly urlSuffix: string;
  /** Clean category page url (`/{url_path}{suffix}`): no page, no query. */
  readonly url: string;
  readonly metaTitle: string | null;
  readonly metaDescription: string | null;
  /** Parent categories ordered from the top level down; empty for a top-level category. */
  readonly breadcrumbs: readonly CategoryBreadcrumb[];
}

/** One page of the products assigned to a category, as Magento paginates them. */
export interface CategoryProductPage {
  readonly items: readonly ProductCard[];
  /** 1-based. */
  readonly currentPage: number;
  readonly pageSize: number;
  /** Zero when the category has no products. */
  readonly totalPages: number;
  readonly totalCount: number;
}

/** Magento's default `category_url_suffix`, for callers that do not read the store config. */
export const DEFAULT_CATEGORY_URL_SUFFIX = '.html';

/** Category page url from Magento's `url_path` and the store's category suffix. */
export function toCategoryUrl(urlPath: string, urlSuffix: string): string {
  return `/${urlPath.replace(/^\/+|\/+$/g, '')}${urlSuffix}`;
}

/** Only a category with products is indexed; an empty one is served `noindex`. */
export function isIndexableListing(listing: CategoryProductPage): boolean {
  return listing.totalCount > 0;
}
