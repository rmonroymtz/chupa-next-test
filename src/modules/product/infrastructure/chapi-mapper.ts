import { z } from 'zod';
import type { ScraperResult } from '@/modules/product/application/ports';
import type {
  Availability,
  ScrapedPrice,
  ScrapedProduct,
  ScrapedVariants,
} from '@/modules/product/domain/product';

/**
 * zod schemas for the scraper API (CHAPI) payloads, following its OpenAPI
 * document. Only the fields the storefront reads are validated; unknown
 * fields are ignored.
 */
const localPriceSchema = z.object({
  current_price: z.number(),
  currency: z.string().nullish(),
  before_price: z.number().nullish(),
});

const usdPriceSchema = z.object({
  usd_current_price: z.number(),
  usd_currency: z.string().nullish(),
  usd_before_price: z.number().nullish(),
});

const productDataSchema = z.object({
  asin: z.string().min(1),
  parent_product_id: z.string().nullish(),
  vendor: z.string().nullish(),
  title: z.string(),
  brand: z.string().nullish(),
  description: z.string().nullish(),
  short_description: z.string().nullish(),
  main_image: z.string().nullish(),
  image: z.string().nullish(),
  thumbnails: z.array(z.object({ link: z.string() })).nullish(),
  price: z.union([localPriceSchema, usdPriceSchema, z.array(z.unknown())]).nullish(),
  stock: z.number().int().nullish(),
  stock_status: z.string().nullish(),
  item_available: z.boolean().nullish(),
  has_variants: z.boolean().nullish(),
  delivery_to: z.boolean().nullish(),
  status: z.string().nullish(),
  breadcrumbs: z.string().nullish(),
  categories: z.array(z.string()).nullish(),
});

const productEnvelopeSchema = z.object({
  vendor: z.string().nullish(),
  status: z.string().nullish(),
  data: z.unknown().optional(),
});

const variantsSchema = z.object({
  asin: z.string().nullish(),
  vendor: z.string().nullish(),
  status: z.string().nullish(),
  variants: z
    .array(
      z.object({
        dimension: z.string(),
        type: z.string(),
        options: z
          .array(
            z.object({
              title: z.string(),
              asin: z.string(),
              image: z.string().nullish(),
              selected: z.boolean().nullish(),
              available: z.boolean().nullish(),
            }),
          )
          .nullish(),
      }),
    )
    .nullish(),
});

type ProductData = z.infer<typeof productDataSchema>;

const INVALID: ScraperResult<never> = { status: 'error', reason: 'invalid_response' };
const NOT_FOUND: ScraperResult<never> = { status: 'not_found' };
const BREADCRUMB_SEPARATOR = '>';

/**
 * Parses `POST /api/v1/product/`. The API reports a missing product with an
 * empty `data` (its default is `[]`), so empty data is `not_found`.
 */
export function parseSearchProductResult(payload: unknown): ScraperResult<ScrapedProduct> {
  const envelope = productEnvelopeSchema.safeParse(payload);
  if (!envelope.success) return INVALID;

  const { data } = envelope.data;
  if (isEmpty(data)) return NOT_FOUND;

  const parsed = productDataSchema.safeParse(data);
  if (!parsed.success) return INVALID;
  return { status: 'found', product: toScrapedProduct(parsed.data, envelope.data.vendor) };
}

/** Parses `POST /api/v1/product/variants/`; a payload without asin is `not_found`. */
export function parseVariantsResult(payload: unknown): ScraperResult<ScrapedVariants> {
  const parsed = variantsSchema.safeParse(payload);
  if (!parsed.success) return INVALID;
  const { asin, vendor, variants } = parsed.data;
  if (!asin) return NOT_FOUND;

  return {
    status: 'found',
    product: {
      sku: asin,
      vendor: vendor ?? '',
      dimensions: (variants ?? []).map((variant) => ({
        dimension: variant.dimension,
        type: variant.type,
        options: (variant.options ?? []).map((option) => ({
          title: option.title,
          sku: option.asin,
          image: option.image || null,
          selected: option.selected ?? false,
          available: option.available ?? true,
        })),
      })),
    },
  };
}

function toScrapedProduct(
  data: ProductData,
  envelopeVendor: string | null | undefined,
): ScrapedProduct {
  const images = [
    data.main_image,
    data.image,
    ...(data.thumbnails ?? []).map((thumb) => thumb.link),
  ]
    .map((url) => url?.trim() ?? '')
    .filter((url) => url !== '');

  return {
    sku: data.asin,
    parentSku: data.parent_product_id || null,
    vendor: data.vendor || envelopeVendor || '',
    title: data.title,
    brand: data.brand || null,
    descriptionHtml: data.description ?? '',
    shortDescription: data.short_description ?? '',
    images: [...new Set(images)],
    price: toPrice(data.price),
    stock: data.stock ?? null,
    availability: toAvailability(data.stock_status),
    itemAvailable: data.item_available ?? true,
    hasVariants: data.has_variants ?? false,
    deliveryTo: data.delivery_to ?? false,
    condition: data.status || null,
    breadcrumbs: (data.breadcrumbs ?? '')
      .split(BREADCRUMB_SEPARATOR)
      .map((crumb) => crumb.trim())
      .filter((crumb) => crumb !== ''),
    categories: data.categories ?? [],
  };
}

/** Copies the price as returned; zero or missing previous prices become null. */
function toPrice(price: ProductData['price']): ScrapedPrice | null {
  if (!price || Array.isArray(price)) return null;
  if ('current_price' in price) {
    return {
      current: price.current_price,
      currency: price.currency || null,
      before: price.before_price || null,
    };
  }
  return {
    current: price.usd_current_price,
    currency: price.usd_currency || 'USD',
    before: price.usd_before_price || null,
  };
}

function toAvailability(status: string | null | undefined): Availability {
  const normalized = status?.trim().toLowerCase();
  if (normalized === 'in_stock') return 'in_stock';
  if (normalized === 'out_of_stock') return 'out_of_stock';
  return 'unknown';
}

function isEmpty(data: unknown): boolean {
  if (data === undefined || data === null) return true;
  if (Array.isArray(data)) return true;
  return typeof data === 'object' && Object.keys(data).length === 0;
}
