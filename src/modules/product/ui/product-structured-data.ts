import { getDisplayPrice } from '@/modules/product/domain/display-price';
import type {
  Availability,
  CategoryLink,
  MagentoProduct,
  ProductCategory,
} from '@/modules/product/domain/product';
import { htmlToPlainText } from '@/modules/product/ui/html-to-text';
import { SEARCH_PATH, siteRootUrl } from '@/modules/seo/domain/site';

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

export interface BreadcrumbListJsonLd {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'BreadcrumbList';
  readonly itemListElement: readonly {
    readonly '@type': 'ListItem';
    readonly position: number;
    readonly name: string;
    readonly item: string;
  }[];
}

/**
 * Category pages are not served by Magento routing on the current site: the
 * legacy menu links categories to the search page with this store, so
 * breadcrumbs point where shoppers actually land.
 */
const CATEGORY_SEARCH_STORE = 'amazon';

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

/** Inicio → deepest Magento category path → product, with absolute urls. */
export function buildBreadcrumbJsonLd(
  product: MagentoProduct,
  { baseUrl, canonicalUrl }: { readonly baseUrl: string; readonly canonicalUrl: string },
): BreadcrumbListJsonLd {
  const root = siteRootUrl(baseUrl);
  const category = deepestCategory(product.categories);
  const trail = category ? [...category.breadcrumbs, category] : [];
  const items = [
    { name: 'Inicio', item: root },
    ...trail
      .filter((link): link is CategoryLink & { urlPath: string } => Boolean(link.urlPath))
      .map((link) => ({ name: link.name, item: categoryUrl(root, link.urlPath) })),
    { name: product.name, item: canonicalUrl },
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      ...entry,
    })),
  };
}

function deepestCategory(categories: readonly ProductCategory[]): ProductCategory | undefined {
  return categories.reduce<ProductCategory | undefined>(
    (deepest, category) =>
      !deepest || category.breadcrumbs.length > deepest.breadcrumbs.length ? category : deepest,
    undefined,
  );
}

function categoryUrl(root: string, urlPath: string): string {
  const query = new URLSearchParams({ query: urlPath, store: CATEGORY_SEARCH_STORE });
  return `${root}${SEARCH_PATH.slice(1)}?${query.toString()}`;
}

function plainText(html: string): string {
  return htmlToPlainText(html).replace(/\s+/g, ' ').trim();
}
