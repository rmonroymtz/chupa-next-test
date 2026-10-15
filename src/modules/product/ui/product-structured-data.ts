import { DEFAULT_CATEGORY_URL_SUFFIX, toCategoryUrl } from '@/modules/category/domain/category';
import { getDisplayPrice } from '@/modules/product/domain/display-price';
import type {
  Availability,
  CategoryLink,
  MagentoProduct,
  ProductCategory,
} from '@/modules/product/domain/product';
import { htmlToPlainText } from '@/modules/product/ui/html-to-text';
import {
  buildBreadcrumbListJsonLd,
  type BreadcrumbListJsonLd,
} from '@/modules/seo/domain/breadcrumb-list';
import { siteRootUrl } from '@/modules/seo/domain/site';

type SchemaAvailability = 'https://schema.org/InStock' | 'https://schema.org/OutOfStock';

export interface OfferJsonLd {
  readonly '@type': 'Offer';
  readonly price: number;
  readonly priceCurrency: string;
  readonly availability?: SchemaAvailability;
  readonly url: string;
}

export interface ProductJsonLd {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'Product';
  readonly name: string;
  readonly sku: string;
  readonly image?: readonly string[];
  readonly description?: string;
  readonly brand?: { readonly '@type': 'Brand'; readonly name: string };
  readonly url: string;
  readonly offers?: OfferJsonLd;
}

/** Unknown availability is omitted rather than guessed. */
export function toSchemaAvailability(availability: Availability): SchemaAvailability | undefined {
  switch (availability) {
    case 'in_stock':
      return 'https://schema.org/InStock';
    case 'out_of_stock':
      return 'https://schema.org/OutOfStock';
    default:
      return undefined;
  }
}

/**
 * Product + Offer for a product stored in Magento. The offer price is
 * `getDisplayPrice`, the same value the page shows. Magento exposes no item
 * condition, so `itemCondition` is not declared.
 */
export function buildProductJsonLd(product: MagentoProduct, canonicalUrl: string): ProductJsonLd {
  const description = plainText(product.descriptionHtml) || plainText(product.shortDescriptionHtml);
  const price = getDisplayPrice(product);
  const availability = toSchemaAvailability(product.availability);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku,
    ...(product.images.length > 0 ? { image: product.images.map((image) => image.url) } : {}),
    ...(description ? { description } : {}),
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
    url: canonicalUrl,
    ...(price
      ? {
          offers: {
            '@type': 'Offer',
            price: price.amount,
            priceCurrency: price.currency,
            ...(availability ? { availability } : {}),
            url: canonicalUrl,
          },
        }
      : {}),
  };
}

interface BreadcrumbJsonLdOptions {
  readonly baseUrl: string;
  readonly canonicalUrl: string;
  /**
   * Store `category_url_suffix`. The product query does not read the store
   * config, so it defaults to Magento's `.html`, the suffix of the store's
   * category urls today.
   */
  readonly categoryUrlSuffix?: string;
}

/**
 * Inicio → deepest Magento category path → product, with absolute urls. The
 * categories link to their category pages (`/{url_path}{suffix}`), the same
 * urls the menu and the category breadcrumbs use.
 */
export function buildBreadcrumbJsonLd(
  product: MagentoProduct,
  {
    baseUrl,
    canonicalUrl,
    categoryUrlSuffix = DEFAULT_CATEGORY_URL_SUFFIX,
  }: BreadcrumbJsonLdOptions,
): BreadcrumbListJsonLd {
  const root = siteRootUrl(baseUrl);
  const category = deepestCategory(product.categories);
  const trail = category ? [...category.breadcrumbs, category] : [];
  return buildBreadcrumbListJsonLd([
    { name: 'Inicio', item: root },
    ...trail
      .filter((link): link is CategoryLink & { urlPath: string } => Boolean(link.urlPath))
      .map((link) => ({
        name: link.name,
        item: `${root}${toCategoryUrl(link.urlPath, categoryUrlSuffix).slice(1)}`,
      })),
    { name: product.name, item: canonicalUrl },
  ]);
}

function deepestCategory(categories: readonly ProductCategory[]): ProductCategory | undefined {
  return categories.reduce<ProductCategory | undefined>(
    (deepest, category) =>
      !deepest || category.breadcrumbs.length > deepest.breadcrumbs.length ? category : deepest,
    undefined,
  );
}

function plainText(html: string): string {
  return htmlToPlainText(html).replace(/\s+/g, ' ').trim();
}
