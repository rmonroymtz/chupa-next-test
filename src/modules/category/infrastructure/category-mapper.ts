import {
  toCategoryUrl,
  type Category,
  type CategoryBreadcrumb,
  type CategoryProductPage,
} from '@/modules/category/domain/category';
import {
  mapProductCard,
  type ProductCardDto,
} from '@/modules/product/infrastructure/magento-product-mapper';

type Nullable<T> = T | null | undefined;

interface BreadcrumbDto {
  category_uid?: Nullable<string>;
  category_name?: Nullable<string>;
  category_url_path?: Nullable<string>;
  category_level?: Nullable<number>;
}

/** Shape selected by CATEGORY_BY_UID_QUERY (all fields optional for safety). */
export interface CategoryDto {
  uid?: Nullable<string>;
  name?: Nullable<string>;
  description?: Nullable<string>;
  url_key?: Nullable<string>;
  url_path?: Nullable<string>;
  meta_title?: Nullable<string>;
  meta_description?: Nullable<string>;
  breadcrumbs?: Nullable<Nullable<BreadcrumbDto>[]>;
}

/** Same card fields the product list queries select. */
export type CategoryProductDto = ProductCardDto;

/** Shape selected by CATEGORY_PRODUCTS_QUERY. */
export interface CategoryProductsDto {
  total_count?: Nullable<number>;
  page_info?: Nullable<{
    current_page?: Nullable<number>;
    page_size?: Nullable<number>;
    total_pages?: Nullable<number>;
  }>;
  items?: Nullable<Nullable<CategoryProductDto>[]>;
}

/** Null when the category lacks what a category page needs (uid, name, url path). */
export function mapCategory(dto: CategoryDto, urlSuffix: Nullable<string>): Category | null {
  const uid = blankToNull(dto.uid);
  const name = blankToNull(dto.name);
  const urlPath = blankToNull(dto.url_path);
  if (!uid || !name || !urlPath) return null;
  const suffix = urlSuffix ?? '';
  return {
    uid,
    name,
    description: dto.description?.trim() ? dto.description : null,
    urlPath,
    urlSuffix: suffix,
    url: toCategoryUrl(urlPath, suffix),
    metaTitle: blankToNull(dto.meta_title),
    metaDescription: blankToNull(dto.meta_description),
    breadcrumbs: mapBreadcrumbs(dto.breadcrumbs, suffix),
  };
}

/** Null when Magento's answer has no usable page info or total count. */
export function mapCategoryProductPage(dto: CategoryProductsDto): CategoryProductPage | null {
  const info = dto.page_info;
  const currentPage = info?.current_page;
  const pageSize = info?.page_size;
  const totalPages = info?.total_pages;
  const totalCount = dto.total_count;
  if (!isCount(currentPage) || !isCount(pageSize) || !isCount(totalPages) || !isCount(totalCount)) {
    return null;
  }
  return {
    items: (dto.items ?? []).flatMap((item) => (item ? (mapProductCard(item) ?? []) : [])),
    currentPage,
    pageSize,
    totalPages,
    totalCount,
  };
}

/** Breadcrumbs from the top level down; Magento does not guarantee their order. */
function mapBreadcrumbs(
  breadcrumbs: CategoryDto['breadcrumbs'],
  suffix: string,
): CategoryBreadcrumb[] {
  return (breadcrumbs ?? [])
    .filter((crumb): crumb is BreadcrumbDto => Boolean(crumb))
    .map((crumb, index) => ({ crumb, index }))
    .sort(
      (a, b) => (a.crumb.category_level ?? 0) - (b.crumb.category_level ?? 0) || a.index - b.index,
    )
    .flatMap(({ crumb }) => {
      const uid = blankToNull(crumb.category_uid);
      const name = blankToNull(crumb.category_name);
      const urlPath = blankToNull(crumb.category_url_path);
      return uid && name && urlPath ? [{ uid, name, url: toCategoryUrl(urlPath, suffix) }] : [];
    });
}

function isCount(value: Nullable<number>): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function blankToNull(value: Nullable<string>): string | null {
  return value && value.trim() !== '' ? value.trim() : null;
}
