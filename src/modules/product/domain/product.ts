/**
 * Product view models. Pure domain types: no framework imports and no I/O.
 *
 * Prices are always displayed as returned by the source (Magento or the
 * scraper API); the storefront never converts or computes them.
 */

export interface Money {
  readonly amount: number;
  /** ISO 4217 code as returned by the source. */
  readonly currency: string;
}

export type Availability = 'in_stock' | 'out_of_stock' | 'unknown';

export interface ProductImage {
  readonly url: string;
  readonly label: string | null;
}

export interface CategoryLink {
  readonly name: string;
  readonly urlPath: string | null;
}

export interface ProductCategory extends CategoryLink {
  /** Ancestors from the root, excluding the category itself. */
  readonly breadcrumbs: readonly CategoryLink[];
}

export interface MagentoPrice {
  readonly final: Money;
  readonly regular: Money;
  readonly discount: { readonly amountOff: number; readonly percentOff: number } | null;
}

export interface ConfigurableOption {
  readonly uid: string;
  readonly attributeCode: string;
  readonly label: string;
  readonly values: readonly {
    readonly uid: string | null;
    readonly label: string;
    readonly valueIndex: number;
  }[];
}

export interface ProductVariant {
  readonly uid: string;
  readonly sku: string;
  readonly name: string | null;
  readonly availability: Availability;
  readonly price: { readonly final: Money; readonly regular: Money } | null;
  readonly attributes: readonly {
    readonly code: string;
    readonly label: string;
    readonly valueIndex: number;
  }[];
}

export interface RelatedProduct {
  readonly uid: string;
  readonly sku: string;
  readonly name: string;
  /** Url path relative to the site root, e.g. `ebay-1-shirt.html`. */
  readonly relativeUrl: string;
  readonly image: ProductImage | null;
  readonly price: Money | null;
}

/** Product copy stored in Magento. */
export interface MagentoProduct {
  readonly uid: string;
  readonly typename: string;
  readonly sku: string;
  readonly name: string;
  readonly urlKey: string;
  /** Url path relative to the site root, with a literal `|`. */
  readonly relativeUrl: string;
  readonly descriptionHtml: string;
  readonly shortDescriptionHtml: string;
  readonly metaTitle: string | null;
  readonly metaDescription: string | null;
  /** Enabled gallery images sorted by position. */
  readonly images: readonly ProductImage[];
  /** Null when Magento returned no amount or currency. */
  readonly price: MagentoPrice | null;
  readonly availability: Availability;
  readonly categories: readonly ProductCategory[];
  readonly deliveryTo: boolean | null;
  readonly productStatus: string | null;
  readonly brand: string | null;
  readonly configurableOptions: readonly ConfigurableOption[];
  readonly variants: readonly ProductVariant[];
  /** Alternatives shown on the PDP. */
  readonly related: readonly RelatedProduct[];
}

export interface ScrapedPrice {
  readonly current: number;
  /** Currency code as returned by the API; null when it sent none. */
  readonly currency: string | null;
  /** Previous price; null when absent or zero. */
  readonly before: number | null;
}

/** Live product data from the scraper API (CHAPI). */
export interface ScrapedProduct {
  /** Product id at the vendor (`asin` in the API payload). */
  readonly sku: string;
  readonly parentSku: string | null;
  readonly vendor: string;
  readonly title: string;
  readonly brand: string | null;
  readonly descriptionHtml: string;
  readonly shortDescription: string;
  /** Main image first, then thumbnails, de-duplicated. */
  readonly images: readonly string[];
  /** Null when the API returned no price. */
  readonly price: ScrapedPrice | null;
  readonly stock: number | null;
  readonly availability: Availability;
  readonly itemAvailable: boolean;
  readonly hasVariants: boolean;
  readonly deliveryTo: boolean;
  /** Vendor condition label, e.g. `New with tags`. */
  readonly condition: string | null;
  readonly breadcrumbs: readonly string[];
  readonly categories: readonly string[];
}

export interface ScrapedVariantOption {
  readonly title: string;
  readonly sku: string;
  readonly image: string | null;
  readonly selected: boolean;
  readonly available: boolean;
}

export interface ScrapedVariantDimension {
  readonly dimension: string;
  readonly type: string;
  readonly options: readonly ScrapedVariantOption[];
}

export interface ScrapedVariants {
  readonly sku: string;
  readonly vendor: string;
  readonly dimensions: readonly ScrapedVariantDimension[];
}
